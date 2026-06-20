// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\ai\ai.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RoleIA } from '@prisma/client';
import { PlansService } from '../plans/plans.service';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function groqQuotaMessage(status: number, retryAfter?: string): string {
  if (status === 429) {
    const seconds = retryAfter ? parseInt(retryAfter) : 30;
    return `⚠️ Limite de requêtes atteinte. Réessaie dans ${seconds} secondes. (Le service IA est temporairement saturé.)`;
  }
  return `⚠️ Le service IA est temporairement indisponible. Réessaie dans quelques instants.`;
}

const EMBEDDING_RATE_LIMITED = "⚠️ Le service d'indexation est temporairement saturé. Réessaie dans quelques instants.";

// Detect the language of a question to use in system prompts
function detectLanguageInstruction(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  const frenchPattern = /\b(le|la|les|un|une|des|est|sont|avec|pour|dans|que|qui|comment|quoi|où|quand|pourquoi|bonjour|merci|s'il|vous|nous|je|tu|il|elle|ils|elles)\b/i;

  if (arabicPattern.test(text)) return 'Arabic';
  if (frenchPattern.test(text)) return 'French';
  return 'English';
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private plans: PlansService,
  ) {}

  private extractText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractText(child)).join(' ');
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

  // Returns null on 429 — callers must handle null and show a friendly message
  private async getEmbedding(text: string): Promise<number[] | null> {
    const key = process.env.GEMINI_API_KEY;
    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-embedding-001:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      },
    );
    if (res.status === 429) return null;
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.embedding.values;
  }

  // Public wrapper — also returns null on 429
  async getEmbeddingPublic(text: string): Promise<number[] | null> {
    return this.getEmbedding(text);
  }

  private async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (res.status === 429 || res.status === 503) {
      const retryAfter = res.headers.get('retry-after') ?? undefined;
      return groqQuotaMessage(res.status, retryAfter);
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error: ${res.status} ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'No response generated.';
  }

  // ── Inline rewrite ────────────────────────────────────────────────────────
  async inlineRewrite(
    text: string,
    action: 'improve' | 'simplify' | 'rephrase' | 'translate_en' | 'translate_fr' | 'translate_ar',
  ): Promise<string> {
    if (!text || text.trim().length < 5)
      throw new BadRequestException('Text is too short.');

    const prompts: Record<string, { system: string; user: string }> = {
      improve: {
        system: 'You are an expert editor. Improve the following text: fix grammar, enhance clarity, strengthen vocabulary, and improve flow. Keep the same language and meaning. Return ONLY the improved text, no explanation, no preamble.',
        user: text,
      },
      simplify: {
        system: 'You are a language simplification expert. Rewrite the following text in plain, simple language. Remove jargon. Keep the same language. Return ONLY the simplified text, no explanation, no preamble.',
        user: text,
      },
      rephrase: {
        system: 'You are a writing assistant. Rephrase the following text differently while keeping the exact same meaning. Keep the same language. Return ONLY the rephrased text, no explanation, no preamble.',
        user: text,
      },
      translate_en: {
        system: 'You are a professional translator. Translate the following text to English. Return ONLY the translated text in English, no explanation, no preamble, no notes.',
        user: text,
      },
      translate_fr: {
        system: 'You are a professional translator. Translate the following text to French. Return ONLY the translated text in French, no explanation, no preamble, no notes.',
        user: text,
      },
      translate_ar: {
        system: 'You are a professional translator. Translate the following text to Arabic. Return ONLY the translated text in Arabic, no explanation, no preamble, no notes.',
        user: text,
      },
    };

    const selected = prompts[action];
    if (!selected) throw new BadRequestException('Invalid action.');
    return this.generateText(selected.user, selected.system);
  }

  // ── Document action buttons ───────────────────────────────────────────────
  async documentActions(
    userId: string,
    docId: string,
    action: 'decisions' | 'tasks' | 'keypoints' | 'structure',
  ): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: { workspace: { include: { membres: { where: { utilisateurId: userId } } } } },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    if (!doc.workspace.membres.length) throw new ForbiddenException('Access denied.');

    const text = this.extractText(doc.contenu);
    if (!text || text.trim().length < 30) throw new BadRequestException('Document is too short.');

    const truncated = text.slice(0, 8000);
    const prompts: Record<string, { system: string; user: string }> = {
      decisions: {
        system: 'You are an expert analyst. Extract all decisions, conclusions, and agreed-upon points from the document. Present them as a numbered list. You MUST respond in the same language as the document content — if the document is in Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Output ONLY the list, no explanation.',
        user: `Document title: ${doc.titre}\n\nContent:\n${truncated}`,
      },
      tasks: {
        system: 'You are a project manager assistant. Convert the content of this document into a clear, actionable task list. Each task should start with a verb. You MUST respond in the same language as the document content — if the document is in Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Output ONLY the task list, no explanation.',
        user: `Document title: ${doc.titre}\n\nContent:\n${truncated}`,
      },
      keypoints: {
        system: 'You are a professional summarizer. Extract the 5 to 10 most important key points from this document as a bullet list. You MUST respond in the same language as the document content — if the document is in Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Output ONLY the key points, no explanation.',
        user: `Document title: ${doc.titre}\n\nContent:\n${truncated}`,
      },
      structure: {
        system: "You are a document architect. Generate a clean report structure with sections and subsections based on this document's content. You MUST respond in the same language as the document content — if the document is in Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Output ONLY the structure, no explanation.",
        user: `Document title: ${doc.titre}\n\nContent:\n${truncated}`,
      },
    };

    const selected = prompts[action];
    if (!selected) throw new BadRequestException('Invalid action.');
    return this.generateText(selected.user, selected.system);
  }

  // ── Index document + auto-tags ────────────────────────────────────────────
  async indexDocument(documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
      if (!doc || !doc.contenu) return;

      const text = this.extractText(doc.contenu);
      if (!text.trim()) return;

      const chunks = this.chunkText(text);
      await this.prisma.$executeRaw`DELETE FROM document_chunks WHERE "documentId" = ${documentId}`;

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.getEmbedding(chunks[i]);
        if (!embedding) {
          console.warn(`Embedding rate-limited for doc ${documentId}, chunk ${i} — skipping`);
          continue;
        }
        const vectorStr = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
          INSERT INTO document_chunks ("id", "documentId", "contenu", "embedding", "chunkIndex", "dateCreation")
          VALUES (gen_random_uuid(), ${documentId}, ${chunks[i]}, ${vectorStr}::vector, ${i}, NOW())
        `;
      }

      await this.prisma.document.update({ where: { id: documentId }, data: { estIndexe: true } });
      console.log(`Indexed doc ${documentId} — ${chunks.length} chunks`);
      this.extractAndSaveTags(documentId, text).catch(() => {});
    } catch (err) {
      console.error('Indexing error for doc', documentId, err);
    }
  }

  // ── Auto-tags ─────────────────────────────────────────────────────────────
  private async extractAndSaveTags(documentId: string, text: string): Promise<void> {
    try {
      const prompt = `Extract 3 to 5 short keywords or tags that best describe the following document.
Rules:
- Return ONLY a JSON array of strings, nothing else. Example: ["tag1", "tag2", "tag3"]
- Each tag should be 1-3 words maximum
- Tags should be in the same language as the document
- No punctuation in tags, lowercase only
- Do not include generic words like "document", "text", "content"

Document text (first 2000 chars):
${text.slice(0, 2000)}

JSON array of tags:`;

      const raw = await this.generateText(prompt);
      if (raw.startsWith('⚠️')) return;

      const cleaned = raw.replace(/```json|```/g, '').trim();
      const tags: string[] = JSON.parse(cleaned);

      if (Array.isArray(tags) && tags.length > 0) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { tags: tags.slice(0, 5).map((t) => String(t).toLowerCase().trim()) },
        });
        console.log(`Tags saved for doc ${documentId}: ${tags.join(', ')}`);
      }
    } catch {
      // best-effort
    }
  }

  // ── Reindex workspace ─────────────────────────────────────────────────────
  async reindexWorkspace(userId: string, workspaceId: string): Promise<{ indexed: number }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const docs = await this.prisma.document.findMany({
      where: { workspaceId, estArchive: false },
      select: { id: true },
    });
    for (const doc of docs) this.indexDocument(doc.id);
    return { indexed: docs.length };
  }

  // ── Standard RAG chat ─────────────────────────────────────────────────────
  async chat(
    userId: string,
    workspaceId: string,
    question: string,
    docId?: string,
    conversationId?: string,
  ): Promise<{ answer: string; sources: any[]; conversationId: string }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    await this.plans.assertCanUseAi(userId, workspaceId);

    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      const titre = question.length > 60 ? question.slice(0, 57) + '...' : question;
      conversation = await this.prisma.conversation.create({
        data: { utilisateurId: userId, workspaceId, documentId: docId || null, titre },
      });
    }

    await this.prisma.messageIA.create({
      data: { conversationId: conversation.id, role: RoleIA.UTILISATEUR, contenu: question },
    });

    // Detect the question language upfront for consistent responses
    const questionLang = detectLanguageInstruction(question);

    // Check if it's a translation request — handle directly without RAG
    const isTranslationRequest = this.detectTranslationRequest(question);
    if (isTranslationRequest && docId) {
      const answer = await this.handleTranslationInChat(userId, docId, question, questionLang);
      await this.prisma.messageIA.create({
        data: {
          conversationId: conversation.id,
          role: RoleIA.ASSISTANT,
          contenu: answer,
          sources: Prisma.JsonNull,
        },
      });
      await this.prisma.conversation.update({ where: { id: conversation.id }, data: { dateMiseAJour: new Date() } });
      await this.plans.incrementAiUsage(userId, workspaceId);
      return { answer, sources: [], conversationId: conversation.id };
    }

    const questionEmbedding = await this.getEmbedding(question);
    if (!questionEmbedding) {
      return { answer: EMBEDDING_RATE_LIMITED, sources: [], conversationId: conversation.id };
    }

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

    let answer: string;
    let sources: any[] = [];

    if (chunks.length === 0) {
      const noContentMessages: Record<string, string> = {
        Arabic: 'لم أجد أي محتوى ذي صلة في المستندات. تأكد من حفظ المستندات ليتم فهرستها.',
        French: "Je n'ai trouvé aucun contenu pertinent dans les documents. Assurez-vous que les documents ont été sauvegardés pour être indexés.",
        English: "I couldn't find any relevant content in the documents. Make sure the documents have been saved to be indexed.",
      };
      answer = noContentMessages[questionLang] || noContentMessages.French;
    } else {
      const context = chunks.map((c, i) => `[Source ${i + 1} — ${c.titre}]:\n${c.contenu}`).join('\n\n');
      const systemPrompt = `You are a helpful assistant that answers questions based strictly on the provided document context. Do not use outside knowledge.

CRITICAL LANGUAGE RULE: The user is writing in ${questionLang}. You MUST respond ENTIRELY in ${questionLang}. Every single word of your response must be in ${questionLang}. Do not mix languages.

If the answer is not found in the context, say so clearly in ${questionLang}.`;

      answer = await this.generateText(
        `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer based only on the context above:`,
        systemPrompt,
      );
      const seen = new Set<string>();
      sources = chunks
        .filter((c) => { if (seen.has(c.documentId)) return false; seen.add(c.documentId); return true; })
        .map((c) => ({ documentId: c.documentId, titre: c.titre, excerpt: c.contenu.slice(0, 150) + '...' }));
    }

    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.ASSISTANT,
        contenu: answer,
        sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { dateMiseAJour: new Date() } });
    await this.plans.incrementAiUsage(userId, workspaceId);
    return { answer, sources, conversationId: conversation.id };
  }

  // ── Detect if a question is a translation request ─────────────────────────
  private detectTranslationRequest(question: string): boolean {
    const q = question.toLowerCase();
    const patterns = [
      /translat/i,
      /tradu/i,
      /ترجم/,
      /into (english|french|arabic)/i,
      /en (anglais|français|arabe)/i,
      /إلى (الإنجليزية|الفرنسية|العربية)/,
      /to (english|french|arabic)/i,
    ];
    return patterns.some((p) => p.test(q));
  }

  // ── Handle translation inside chat (translates document content) ──────────
  private async handleTranslationInChat(
    userId: string,
    docId: string,
    question: string,
    questionLang: string,
  ): Promise<string> {
    const doc = await this.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return questionLang === 'Arabic' ? 'لم يتم العثور على المستند.' : 'Document not found.';

    const text = this.extractText(doc.contenu);
    if (!text || text.trim().length < 10) {
      return questionLang === 'Arabic'
        ? 'المستند فارغ أو لا يحتوي على نص كافٍ للترجمة.'
        : questionLang === 'French'
          ? 'Le document est vide ou ne contient pas assez de texte pour être traduit.'
          : 'The document is empty or does not contain enough text to translate.';
    }

    // Detect target language from the question
    let targetLang = 'English';
    const q = question.toLowerCase();
    if (/french|français|فرنسية/.test(q)) targetLang = 'French';
    else if (/arabic|arabe|عربية|العربية/.test(q)) targetLang = 'Arabic';
    else if (/english|anglais|إنجليزية|الإنجليزية/.test(q)) targetLang = 'English';

    const systemPrompt = `You are a professional translator. Translate the provided text to ${targetLang}. Return ONLY the translated text. Do not add explanations, notes, or preambles.`;
    const truncated = text.slice(0, 6000);
    return this.generateText(`Translate this text to ${targetLang}:\n\n${truncated}`, systemPrompt);
  }

  // ── Multi-doc RAG chat ────────────────────────────────────────────────────
  async chatMultiDoc(
    userId: string,
    workspaceId: string,
    question: string,
    documentIds: string[],
    conversationId?: string,
  ): Promise<{ answer: string; sources: any[]; conversationId: string }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    await this.plans.assertCanUseAi(userId, workspaceId);

    if (!documentIds || documentIds.length === 0)
      throw new BadRequestException('At least one document must be selected.');

    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      const titre = question.length > 60 ? question.slice(0, 57) + '...' : question;
      conversation = await this.prisma.conversation.create({
        data: { utilisateurId: userId, workspaceId, documentId: null, titre },
      });
    }

    await this.prisma.messageIA.create({
      data: { conversationId: conversation.id, role: RoleIA.UTILISATEUR, contenu: question },
    });

    const questionLang = detectLanguageInstruction(question);

    const questionEmbedding = await this.getEmbedding(question);
    if (!questionEmbedding) {
      return { answer: EMBEDDING_RATE_LIMITED, sources: [], conversationId: conversation.id };
    }

    const vectorStr = `[${questionEmbedding.join(',')}]`;
    const allChunks = await this.prisma.$queryRaw<any[]>`
      SELECT dc.id, dc."documentId", dc.contenu, d.titre,
        1 - (dc.embedding <=> ${vectorStr}::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc."documentId"
      WHERE d."workspaceId" = ${workspaceId}
        AND d."estArchive" = false
      ORDER BY dc.embedding <=> ${vectorStr}::vector
      LIMIT 50
    `;

    const docIdSet = new Set(documentIds);
    const chunks = allChunks.filter((c) => docIdSet.has(c.documentId)).slice(0, 8);

    let answer: string;
    let sources: any[] = [];

    if (chunks.length === 0) {
      const noContentMessages: Record<string, string> = {
        Arabic: 'لم يتم العثور على محتوى مفهرس في المستندات المحددة. تأكد من حفظها بعد إنشائها.',
        French: "Aucun contenu indexé trouvé dans les documents sélectionnés. Assurez-vous qu'ils ont été sauvegardés après leur création.",
        English: 'No indexed content found in the selected documents. Make sure they were saved after creation.',
      };
      answer = noContentMessages[questionLang] || noContentMessages.French;
    } else {
      const context = chunks.map((c, i) => `[Source ${i + 1} — ${c.titre}]:\n${c.contenu}`).join('\n\n');
      const systemPrompt = `You are a helpful assistant. Answer the question based ONLY on the following documents. Do not use outside knowledge.

CRITICAL LANGUAGE RULE: The user is writing in ${questionLang}. You MUST respond ENTIRELY in ${questionLang}. Every single word of your response must be in ${questionLang}.`;

      answer = await this.generateText(
        `Documents:\n${context}\n\nQuestion: ${question}\n\nAnswer:`,
        systemPrompt,
      );
      const seen = new Set<string>();
      sources = chunks
        .filter((c) => { if (seen.has(c.documentId)) return false; seen.add(c.documentId); return true; })
        .map((c) => ({ documentId: c.documentId, titre: c.titre, excerpt: c.contenu.slice(0, 150) + '...' }));
    }

    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.ASSISTANT,
        contenu: answer,
        sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { dateMiseAJour: new Date() } });
    await this.plans.incrementAiUsage(userId, workspaceId);
    return { answer, sources, conversationId: conversation.id };
  }

  // ── Workspace secretary chat ──────────────────────────────────────────────
  async chatWorkspace(
    userId: string,
    workspaceId: string,
    question: string,
    conversationId?: string,
  ): Promise<{ answer: string; sources: any[]; conversationId: string; isMeta: boolean }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    await this.plans.assertCanUseAi(userId, workspaceId);

    const questionLang = detectLanguageInstruction(question);

    let isMeta = false;
    try {
      const classifyPrompt = `You are an intent classifier. Classify this question into ONE category:
- "workspace_meta": questions about team members, who joined recently, recent activity, document statistics, who created what, how many documents exist
- "document_rag": questions about the content inside documents, what a document says, summaries, explanations, translations

Question: "${question}"

Reply with ONLY one of these two exact strings: workspace_meta OR document_rag`;
      const intent = await this.generateText(classifyPrompt);
      isMeta = intent.trim().toLowerCase().includes('workspace_meta');
    } catch {
      isMeta = false;
    }

    let conversation = conversationId
      ? await this.prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      const titre = question.length > 60 ? question.slice(0, 57) + '...' : question;
      conversation = await this.prisma.conversation.create({
        data: { utilisateurId: userId, workspaceId, documentId: null, titre },
      });
    }

    await this.prisma.messageIA.create({
      data: { conversationId: conversation.id, role: RoleIA.UTILISATEUR, contenu: question },
    });

    let answer: string;
    const sources: any[] = [];

    if (isMeta) {
      const [members, recentDocs, recentActivity, docCount] = await Promise.all([
        this.prisma.membreWorkspace.findMany({
          where: { workspaceId },
          include: { utilisateur: { select: { nom: true, email: true } } },
          orderBy: { dateAdhesion: 'desc' },
        }),
        this.prisma.document.findMany({
          where: { workspaceId, estArchive: false },
          select: { titre: true, dateMiseAJour: true, author: { select: { nom: true } } },
          orderBy: { dateMiseAJour: 'desc' },
          take: 10,
        }),
        this.prisma.activite.findMany({
          where: { workspaceId },
          include: { user: { select: { nom: true } } },
          orderBy: { dateCreation: 'desc' },
          take: 20,
        }),
        this.prisma.document.count({ where: { workspaceId, estArchive: false } }),
      ]);

      const membersText = members
        .map((m) => `- ${m.utilisateur.nom} (${m.role}) — joined ${new Date(m.dateAdhesion).toLocaleDateString()}`)
        .join('\n');
      const docsText = recentDocs
        .map((d) => `- "${d.titre}" by ${d.author.nom} — modified ${new Date(d.dateMiseAJour).toLocaleDateString()}`)
        .join('\n');
      const activityText = recentActivity
        .map((a) => `- ${a.user.nom}: ${a.action} on ${new Date(a.dateCreation).toLocaleDateString()}`)
        .join('\n');

      const systemPrompt = `You are a helpful workspace secretary. Answer the question using ONLY the workspace data below. Be concise.

CRITICAL LANGUAGE RULE: The user is writing in ${questionLang}. You MUST respond ENTIRELY in ${questionLang}. Every single word of your response must be in ${questionLang}.`;

      answer = await this.generateText(
        `Workspace data:\nMEMBERS (${members.length} total):\n${membersText}\n\nRECENT DOCUMENTS (${docCount} total):\n${docsText}\n\nRECENT ACTIVITY:\n${activityText}\n\nQuestion: ${question}\n\nAnswer:`,
        systemPrompt,
      );
    } else {
      const questionEmbedding = await this.getEmbedding(question);
      if (!questionEmbedding) {
        answer = EMBEDDING_RATE_LIMITED;
      } else {
        const vectorStr = `[${questionEmbedding.join(',')}]`;
        const chunks = await this.prisma.$queryRaw<any[]>`
          SELECT dc.id, dc."documentId", dc.contenu, d.titre,
            1 - (dc.embedding <=> ${vectorStr}::vector) as similarity
          FROM document_chunks dc
          JOIN documents d ON d.id = dc."documentId"
          WHERE d."workspaceId" = ${workspaceId}
            AND d."estArchive" = false
          ORDER BY dc.embedding <=> ${vectorStr}::vector
          LIMIT 5
        `;

        if (chunks.length === 0) {
          const noContentMessages: Record<string, string> = {
            Arabic: 'لم يتم العثور على محتوى مفهرس. تأكد من حفظ مستنداتك ليتم فهرستها.',
            French: 'Aucun contenu indexé trouvé. Assurez-vous que vos documents ont été sauvegardés pour être indexés.',
            English: 'No indexed content found. Make sure your documents have been saved to be indexed.',
          };
          answer = noContentMessages[questionLang] || noContentMessages.French;
        } else {
          const context = chunks.map((c, i) => `[Source ${i + 1} — ${c.titre}]:\n${c.contenu}`).join('\n\n');
          const systemPrompt = `You are a helpful assistant. Answer based strictly on the provided context.

CRITICAL LANGUAGE RULE: The user is writing in ${questionLang}. You MUST respond ENTIRELY in ${questionLang}. Every single word of your response must be in ${questionLang}.`;

          answer = await this.generateText(
            `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`,
            systemPrompt,
          );
          const seen = new Set<string>();
          chunks
            .filter((c) => { if (seen.has(c.documentId)) return false; seen.add(c.documentId); return true; })
            .forEach((c) => sources.push({ documentId: c.documentId, titre: c.titre, excerpt: c.contenu.slice(0, 150) + '...' }));
        }
      }
    }

    await this.prisma.messageIA.create({
      data: {
        conversationId: conversation.id,
        role: RoleIA.ASSISTANT,
        contenu: answer,
        sources: sources.length > 0 ? (sources as any) : Prisma.JsonNull,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { dateMiseAJour: new Date() } });
    await this.plans.incrementAiUsage(userId, workspaceId);
    return { answer, sources, conversationId: conversation.id, isMeta };
  }

  // ── Export conversation as PDF ────────────────────────────────────────────
  async exportConversation(userId: string, conversationId: string): Promise<Buffer> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { dateCreation: 'asc' } },
        utilisateur: { select: { nom: true } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    if (conversation.utilisateurId !== userId) throw new ForbiddenException('Accès refusé.');

    const messagesHtml = conversation.messages
      .map((msg) => {
        const isUser = msg.role === RoleIA.UTILISATEUR;
        const sources = msg.sources as any[] | null;
        const sourcesHtml =
          sources && sources.length > 0
            ? `<div class="sources"><p class="sources-label">Sources :</p>${sources.map((s) => `<span class="source-badge">${s.titre}</span>`).join('')}</div>`
            : '';
        return `
          <div class="message ${isUser ? 'user' : 'assistant'}">
            <div class="message-header">
              <span class="role">${isUser ? conversation.utilisateur.nom : '🤖 Assistant IA'}</span>
              <span class="date">${new Date(msg.dateCreation).toLocaleString('fr-FR')}</span>
            </div>
            <div class="message-content">${msg.contenu.replace(/\n/g, '<br>')}</div>
            ${sourcesHtml}
          </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Conversation — ${conversation.titre}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a2e; background: #fff; }
  .header { background: #1e3a5f; color: white; padding: 20px 28px; margin-bottom: 24px; }
  .header h1 { font-size: 16pt; font-weight: 700; }
  .header p { font-size: 10pt; opacity: 0.8; margin-top: 4px; }
  .messages { padding: 0 28px 28px; display: flex; flex-direction: column; gap: 16px; }
  .message { border-radius: 8px; padding: 14px 18px; max-width: 90%; }
  .message.user { background: #f0f4ff; border-left: 4px solid #6366f1; align-self: flex-end; }
  .message.assistant { background: #f8f9fa; border-left: 4px solid #10b981; }
  .message-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .role { font-weight: 700; font-size: 10pt; color: #374151; }
  .date { font-size: 9pt; color: #9ca3af; }
  .message-content { font-size: 11pt; color: #1f2937; }
  .sources { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
  .sources-label { font-size: 9pt; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .source-badge { display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 9pt; padding: 2px 8px; border-radius: 4px; margin: 2px; }
  .footer { margin-top: 24px; padding: 14px 28px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 9pt; color: #9ca3af; }
</style>
</head>
<body>
  <div class="header">
    <h1>${conversation.titre}</h1>
    <p>Exporté le ${new Date().toLocaleDateString('fr-FR')} · ${conversation.messages.length} messages</p>
  </div>
  <div class="messages">${messagesHtml}</div>
  <div class="footer">Généré par DocuMind</div>
</body>
</html>`;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '15mm', left: '0' },
        printBackground: true,
      });
      return Buffer.from(buffer);
    } finally {
      await browser.close();
    }
  }

  // ── Conversations CRUD ────────────────────────────────────────────────────
  async getConversations(userId: string, workspaceId: string, docId?: string): Promise<any[]> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
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

  async getConversationMessages(userId: string, conversationId: string): Promise<any[]> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    if (conversation.utilisateurId !== userId) throw new ForbiddenException('Accès refusé.');
    return this.prisma.messageIA.findMany({ where: { conversationId }, orderBy: { dateCreation: 'asc' } });
  }

  async deleteConversation(userId: string, conversationId: string): Promise<{ deleted: true }> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    if (conversation.utilisateurId !== userId) throw new ForbiddenException('Accès refusé.');
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
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId: doc.workspace.id } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const text = this.extractText(doc.contenu);
    if (!text.trim()) return 'Ce document ne contient pas encore de contenu à résumer.';

    const systemPrompt = `You are a professional document summarizer. Summarize the document clearly with key points. You MUST respond in the same language as the document content — if Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Never mix languages.`;

    return this.generateText(
      `Title: ${doc.titre}\nContent:\n${text.slice(0, 8000)}\n\nConcise summary:`,
      systemPrompt,
    );
  }

  async simplify(userId: string, docId: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: { workspace: { include: { membres: { where: { utilisateurId: userId } } } } },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    if (!doc.workspace.membres.length) throw new ForbiddenException('Access denied.');

    const rawText = this.extractText(doc.contenu);
    if (!rawText || rawText.trim().length < 30)
      throw new BadRequestException('Document is too short to simplify.');

    const systemPrompt = `You are a language simplification expert. Rewrite the following document in plain, accessible language. Keep the same meaning. You MUST respond in the same language as the original document — if Arabic, respond in Arabic; if French, respond in French; if English, respond in English. Output only the simplified text, no explanations.`;

    return this.generateText(rawText.slice(0, 6000), systemPrompt);
  }

  async generateDocument(
    userId: string,
    workspaceId: string,
    description: string,
    titre: string,
    dossierId?: string,
  ): Promise<{ documentId: string; content: any }> {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Access denied.');
    if (membre.role === 'LECTEUR') throw new ForbiddenException('Read-only access.');

    await this.plans.assertCanCreateDocument(workspaceId);

    let rawResponse = await this.generateText(
      `Generate a complete TipTap JSON document. Output ONLY the raw JSON, no markdown, no explanation.\n\nFormat: {"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Title"}]},{"type":"paragraph","content":[{"type":"text","text":"Content"}]}]}\n\nTitle: "${titre}"\nDescription: "${description}"\n\nGenerate 4-6 sections in the same language as the description. Output only JSON:`,
    );

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
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: titre }] },
          ...rawResponse
            .split('\n\n')
            .filter(Boolean)
            .map((para: string) => ({ type: 'paragraph', content: [{ type: 'text', text: para.trim() }] })),
        ],
      };
    }

    const newDoc = await this.prisma.document.create({
      data: { titre, contenu: tiptapContent, workspaceId, dossierId: dossierId ?? null, authorId: userId },
    });

    this.indexDocument(newDoc.id).catch(() => {});
    return { documentId: newDoc.id, content: tiptapContent };
  }
}