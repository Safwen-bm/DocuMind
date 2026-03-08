import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RoleIA } from '@prisma/client';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  // ── 1. Extract plain text from TipTap JSON ─────────────────────────────
  private extractText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content
        .map((child: any) => this.extractText(child))
        .join(' ');
    }
    return '';
  }

  // ── 2. Split text into chunks (~500 chars with 50 overlap) ─────────────
  private chunkText(text: string, size = 500, overlap = 50): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + size));
      i += size - overlap;
    }
    return chunks.filter((c) => c.trim().length > 20);
  }

  // ── 3. Get embedding vector via Gemini REST ────────────────────────────
  private async getEmbedding(text: string): Promise<number[]> {
    const key = process.env.GEMINI_API_KEY;
    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-embedding-001:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.embedding.values;
  }

  // ── 4. Generate text via Groq REST ────────────────────────────────────
  private async generateText(prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'No response generated.';
  }

  // ── 5. Index a document ───────────────────────────────────────────────
  //  Called after: save in editor, upload, restore version
  async indexDocument(documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!doc || !doc.contenu) return;

      const text = this.extractText(doc.contenu);
      if (!text.trim()) return;

      const chunks = this.chunkText(text);

      // Wipe old chunks
      await this.prisma.$executeRaw`
        DELETE FROM document_chunks WHERE "documentId" = ${documentId}
      `;

      // Insert new chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.getEmbedding(chunks[i]);
        const vectorStr = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
          INSERT INTO document_chunks ("id", "documentId", "contenu", "embedding", "chunkIndex", "dateCreation")
          VALUES (
            gen_random_uuid(),
            ${documentId},
            ${chunks[i]},
            ${vectorStr}::vector,
            ${i},
            NOW()
          )
        `;
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { estIndexe: true },
      });

      console.log(`✅ Indexed doc ${documentId} — ${chunks.length} chunks`);
    } catch (err) {
      // Non-blocking — never crash the caller
      console.error('❌ Indexing error for doc', documentId, err);
    }
  }

  // ── 6. Reindex all documents in a workspace ───────────────────────────
  async reindexWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<{ indexed: number }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const docs = await this.prisma.document.findMany({
      where: { workspaceId, estArchive: false },
      select: { id: true },
    });

    // Fire and forget — don't await, endpoint returns immediately
    for (const doc of docs) {
      this.indexDocument(doc.id);
    }

    return { indexed: docs.length };
  }

  // ── 7. RAG Chat — persists conversation + messages ────────────────────
  async chat(
    userId: string,
    workspaceId: string,
    question: string,
    docId?: string,
    conversationId?: string,
  ): Promise<{
    answer: string;
    sources: { documentId: string; titre: string; excerpt: string }[];
    conversationId: string;
  }> {
    // Verify workspace membership
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    // Get existing conversation or create new one
    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: conversationId },
        })
      : null;

    if (!conversation) {
      // Use first question as conversation title (max 60 chars)
      const titre =
        question.length > 60 ? question.slice(0, 57) + '...' : question;
      conversation = await this.prisma.conversation.create({
        data: {
          utilisateurId: userId,
          workspaceId,
          documentId: docId || null,
          titre,
        },
      });
    }

    // Persist user message
    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.UTILISATEUR,
        contenu: question,
      },
    });

    // Embed the question
    const questionEmbedding = await this.getEmbedding(question);
    const vectorStr = `[${questionEmbedding.join(',')}]`;

    // pgvector cosine similarity search
    const chunks = await this.prisma.$queryRaw<
      {
        id: string;
        documentId: string;
        contenu: string;
        titre: string;
        similarity: number;
      }[]
    >`
      SELECT
        dc.id,
        dc."documentId",
        dc.contenu,
        d.titre,
        1 - (dc.embedding <=> ${vectorStr}::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc."documentId"
      WHERE d."workspaceId" = ${workspaceId}
        AND d."estArchive" = false
        ${docId ? Prisma.sql`AND d.id = ${docId}` : Prisma.sql``}
      ORDER BY dc.embedding <=> ${vectorStr}::vector
      LIMIT 5
    `;

    let answer: string;
    let sources: { documentId: string; titre: string; excerpt: string }[] = [];

    if (chunks.length === 0) {
      answer =
        "I couldn't find any relevant content in the workspace documents. Make sure documents have been saved so they can be indexed.";
    } else {
      const context = chunks
        .map((c, i) => `[Source ${i + 1} — ${c.titre}]:\n${c.contenu}`)
        .join('\n\n');

      const prompt = `You are a helpful assistant that answers questions based strictly on the provided document context. Do not use outside knowledge.

Context from workspace documents:
${context}

Question: ${question}

Answer based only on the context above. If the answer is not in the context, say so clearly.`;

      answer = await this.generateText(prompt);

      // Deduplicate sources by documentId
      const seen = new Set<string>();
      sources = chunks
        .filter((c) => {
          if (seen.has(c.documentId)) return false;
          seen.add(c.documentId);
          return true;
        })
        .map((c) => ({
          documentId: c.documentId,
          titre: c.titre,
          excerpt: c.contenu.slice(0, 150) + '...',
        }));
    }

    // Persist assistant message with sources
    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.ASSISTANT,
        contenu: answer,
        sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
      },
    });

    // Bump conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { dateMiseAJour: new Date() },
    });

    return { answer, sources, conversationId: conversation.id };
  }

  // ── 8. Get conversations list (scoped to workspace, optionally to doc) ─
  async getConversations(
    userId: string,
    workspaceId: string,
    docId?: string,
  ): Promise<any[]> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    return this.prisma.conversation.findMany({
      where: {
        utilisateurId: userId,
        workspaceId,
        // docId passed = filter to that doc; docId is empty string = workspace-wide; undefined = all
        ...(docId !== undefined ? { documentId: docId || null } : {}),
      },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { dateMiseAJour: 'desc' },
      take: 30,
    });
  }

  // ── 9. Get messages for a conversation ────────────────────────────────
  async getConversationMessages(
    userId: string,
    conversationId: string,
  ): Promise<any[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    if (conversation.utilisateurId !== userId)
      throw new ForbiddenException('Accès refusé.');

    return this.prisma.messageIA.findMany({
      where: { conversationId },
      orderBy: { dateCreation: 'asc' },
    });
  }

  // ── 10. Delete a conversation (cascades to messages automatically) ─────
  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ deleted: true }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    if (conversation.utilisateurId !== userId)
      throw new ForbiddenException('Accès refusé.');

    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }

  // ── 11. Summarize a document ──────────────────────────────────────────
  async summarize(userId: string, documentId: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { workspace: { select: { id: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: doc.workspace.id,
        },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const text = this.extractText(doc.contenu);
    if (!text.trim()) return 'This document has no content to summarize.';

    const prompt = `Summarize the following document in a clear, structured way with key points. Use the same language as the document.

Document title: ${doc.titre}
Content:
${text.slice(0, 8000)}

Provide a concise summary with the main topics covered.`;

    return this.generateText(prompt);
  }
}
