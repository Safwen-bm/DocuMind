import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RoleIA } from '@prisma/client';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

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

  private chunkText(text: string, size = 500, overlap = 50): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + size));
      i += size - overlap;
    }
    return chunks.filter((c) => c.trim().length > 20);
  }

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

  async getEmbeddingPublic(text: string): Promise<number[]> {
    return this.getEmbedding(text);
  }

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

  async indexDocument(documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!doc || !doc.contenu) return;

      const text = this.extractText(doc.contenu);
      if (!text.trim()) return;

      const chunks = this.chunkText(text);

      await this.prisma.$executeRaw`
        DELETE FROM document_chunks WHERE "documentId" = ${documentId}
      `;

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.getEmbedding(chunks[i]);
        const vectorStr = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
          INSERT INTO document_chunks ("id", "documentId", "contenu", "embedding", "chunkIndex", "dateCreation")
          VALUES (gen_random_uuid(), ${documentId}, ${chunks[i]}, ${vectorStr}::vector, ${i}, NOW())
        `;
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { estIndexe: true },
      });

      console.log(`Indexed doc ${documentId} — ${chunks.length} chunks`);
    } catch (err) {
      console.error('Indexing error for doc', documentId, err);
    }
  }

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

    for (const doc of docs) {
      this.indexDocument(doc.id);
    }

    return { indexed: docs.length };
  }

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
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({
          where: { id: conversationId },
        })
      : null;

    if (!conversation) {
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

    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.UTILISATEUR,
        contenu: question,
      },
    });

    const questionEmbedding = await this.getEmbedding(question);
    const vectorStr = `[${questionEmbedding.join(',')}]`;

    const chunks = await this.prisma.$queryRaw<
      {
        id: string;
        documentId: string;
        contenu: string;
        titre: string;
        similarity: number;
      }[]
    >`
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

    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.ASSISTANT,
        contenu: answer,
        sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { dateMiseAJour: new Date() },
    });

    return { answer, sources, conversationId: conversation.id };
  }

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
        ...(docId !== undefined ? { documentId: docId || null } : {}),
      },
      include: { _count: { select: { messages: true } } },
      orderBy: { dateMiseAJour: 'desc' },
      take: 30,
    });
  }

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

  // ── FIX 1: renamed extractTextFromTiptap → extractText (already exists above)
  // ── FIX 2: BadRequestException added to imports at top
  async simplify(userId: string, docId: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: {
        workspace: {
          include: { membres: { where: { utilisateurId: userId } } },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    if (!doc.workspace.membres.length)
      throw new ForbiddenException('Access denied.');

    const rawText = this.extractText(doc.contenu);
    if (!rawText || rawText.trim().length < 30) {
      throw new BadRequestException('Document is too short to simplify.');
    }

    const prompt = `You are a language simplification expert. Your task is to rewrite the following document in plain, accessible language that anyone can understand.

Rules:
- Replace all jargon and technical terms with simple everyday words
- Break long sentences into short, clear ones
- Keep the same structure and meaning — just simplify the language
- Do NOT add new information or opinions
- Write in the same language as the original text
- Output only the simplified text, no commentary, no preamble

Document to simplify:
---
${rawText.slice(0, 6000)}
---

Simplified version:`;

    return this.generateText(prompt);
  }

  // ── FIX 3: createurId → authorId  (matches documents.service.ts and your schema)
  // ── FIX 4: indexDocument() takes 1 arg — removed the extra tiptapContent arg
  async generateDocument(
    userId: string,
    workspaceId: string,
    description: string,
    titre: string,
    dossierId?: string,
  ): Promise<{ documentId: string; content: any }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Access denied.');
    if (membre.role === 'LECTEUR')
      throw new ForbiddenException('Read-only access.');

    const prompt = `You are a professional document writer. Generate a complete, well-structured document based on the following description.

Output ONLY valid JSON in TipTap editor format. No explanation, no markdown fences, no extra text — just the raw JSON object.

The TipTap JSON format is:
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Title Here" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Paragraph text here." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section Title" }] },
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item" }] }] }
    ]}
  ]
}

Document title: "${titre}"
Description: "${description}"

Generate a comprehensive, professional document with at least 4-6 sections. Write in the same language as the description.

Output only the JSON:`;

    let rawResponse = await this.generateText(prompt);

    rawResponse = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let tiptapContent: any;
    try {
      tiptapContent = JSON.parse(rawResponse);
    } catch {
      tiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: titre }],
          },
          ...rawResponse
            .split('\n\n')
            .filter(Boolean)
            .map((para: string) => ({
              type: 'paragraph',
              content: [{ type: 'text', text: para.trim() }],
            })),
        ],
      };
    }

    const newDoc = await this.prisma.document.create({
      data: {
        titre,
        contenu: tiptapContent,
        workspaceId,
        dossierId: dossierId ?? null,
        authorId: userId, // ← FIX 3: was createurId
      },
    });

    this.indexDocument(newDoc.id).catch(() => {}); // ← FIX 4: 1 arg only

    return { documentId: newDoc.id, content: tiptapContent };
  }
}
