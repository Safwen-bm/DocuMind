// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\ai\ai.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoleIA, Prisma } from '@prisma/client';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/ai-stream',
})
export class AiStreamGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  // ── Auth: verify JWT from cookie ──────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('access_token='))
          ?.split('=')[1];

      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      (client as any).userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) { /* nothing to clean up */ }

  // ── Stream: document or workspace chat ───────────────────────────────────
  @SubscribeMessage('chat-stream')
  async handleChatStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      workspaceId: string;
      question: string;
      docId?: string;
      conversationId?: string;
      mode: 'document' | 'workspace';
    },
  ) {
    const userId = (client as any).userId;
    if (!userId) { client.emit('ai-error', { message: 'Non authentifié.' }); return; }

    const { workspaceId, question, docId, conversationId, mode } = payload;

    // Verify membership
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) { client.emit('ai-error', { message: 'Accès refusé.' }); return; }

    // Get or create conversation
    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      const titre = question.length > 60 ? question.slice(0, 57) + '...' : question;
      conversation = await this.prisma.conversation.create({
        data: { utilisateurId: userId, workspaceId, documentId: docId || null, titre },
      });
    }

    // Save user message
    await this.prisma.messageIA.create({
      data: { conversationId: conversation.id, role: RoleIA.UTILISATEUR, contenu: question },
    });

    // Emit conversationId to frontend immediately so it can track it
    client.emit('ai-conversation-id', { conversationId: conversation.id });

    try {
      // Get relevant chunks via embedding similarity
      const questionEmbedding = await this.aiService.getEmbeddingPublic(question);
      const vectorStr = `[${questionEmbedding.join(',')}]`;

      const chunks = await this.prisma.$queryRaw<any[]>`
        SELECT dc.id, dc."documentId", dc.contenu, d.titre,
          1 - (dc.embedding <=> ${vectorStr}::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON d.id = dc."documentId"
        WHERE d."workspaceId" = ${workspaceId}
          AND d."estArchive" = false
          ${docId ? Prisma.sql`AND d.id = ${docId}` : Prisma.sql``}
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT 5
      `;

      let fullAnswer = '';
      let sources: any[] = [];

      if (chunks.length === 0) {
        // No chunks — emit a single message, no streaming needed
        fullAnswer = "Je n'ai trouvé aucun contenu pertinent. Assurez-vous que le document a été sauvegardé pour être indexé.";
        client.emit('ai-token', { token: fullAnswer });
        client.emit('ai-done', { sources: [], conversationId: conversation.id });
      } else {
        const context = chunks
          .map((c, i) => `[Source ${i + 1} — ${c.titre}]:\n${c.contenu}`)
          .join('\n\n');

        const prompt = `You are a helpful assistant that answers questions based strictly on the provided document context. Do not use outside knowledge. Always respond in the same language as the question.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer based only on the context above. If the answer is not in the context, say so clearly in the same language as the question.`;

        // ── Groq streaming ────────────────────────────────────────────────
        const res = await fetch(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2048,
            stream: true, // ← enables SSE streaming from Groq
          }),
        });

        if (res.status === 429 || res.status === 503) {
          const retryAfter = res.headers.get('retry-after') ?? '30';
          fullAnswer = `⚠️ Limite de requêtes atteinte. Réessaie dans ${retryAfter} secondes.`;
          client.emit('ai-token', { token: fullAnswer });
          client.emit('ai-done', { sources: [], conversationId: conversation.id });
        } else if (!res.ok) {
          client.emit('ai-error', { message: 'Erreur du service IA.' });
          return;
        } else {
          // ── Read the SSE stream and forward each token ─────────────────
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? ''; // keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content;
                if (token) {
                  fullAnswer += token;
                  // Emit each token to frontend
                  client.emit('ai-token', { token });
                }
              } catch { /* skip malformed chunks */ }
            }
          }

          // Build sources
          const seen = new Set<string>();
          sources = chunks
            .filter((c) => { if (seen.has(c.documentId)) return false; seen.add(c.documentId); return true; })
            .map((c) => ({ documentId: c.documentId, titre: c.titre, excerpt: c.contenu.slice(0, 150) + '...' }));

          // Signal completion with sources
          client.emit('ai-done', { sources, conversationId: conversation.id });
        }
      }

      // Save assistant message to DB
      await this.prisma.messageIA.create({
        data: {
          conversationId: conversation.id,
          role: RoleIA.ASSISTANT,
          contenu: fullAnswer,
          sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { dateMiseAJour: new Date() },
      });

    } catch (err) {
      console.error('AI stream error:', err);
      client.emit('ai-error', { message: 'Une erreur est survenue.' });
    }
  }
}