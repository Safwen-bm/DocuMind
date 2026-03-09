// src/lib/ai.api.ts

import api from "./api";

export interface ChatSource {
  documentId: string;
  titre: string;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  conversationId: string;
}

export interface Conversation {
  id: string;
  titre: string;
  documentId: string | null;
  workspaceId: string;
  dateCreation: string;
  dateMiseAJour: string;
  _count: { messages: number };
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "UTILISATEUR" | "ASSISTANT";
  contenu: string;
  sources?: ChatSource[] | null;
  dateCreation: string;
}

export const aiApi = {
  // ── Chat (RAG) — pass conversationId to continue existing conversation ──
  chat: (
    workspaceId: string,
    question: string,
    docId?: string,
    conversationId?: string,
  ): Promise<ChatResponse> =>
    api
      .post("/ai/chat", { workspaceId, question, docId, conversationId })
      .then((r) => r.data),

  // ── Summarize a document ─────────────────────────────────────────────────
  summarize: (docId: string): Promise<string> =>
    api.post(`/ai/summarize/${docId}`).then((r) => r.data),

  // ── Simplify a document ───────────────────────────────────────────────────
  simplify: (docId: string): Promise<string> =>
    api.post(`/ai/simplify/${docId}`).then((r) => r.data),

  // ── Generate a document from description ─────────────────────────────────
  generateDocument: (
    workspaceId: string,
    titre: string,
    description: string,
    dossierId?: string,
  ): Promise<{ documentId: string; content: any }> =>
    api
      .post("/ai/generate", { workspaceId, titre, description, dossierId })
      .then((r) => r.data),

  // ── Reindex all docs in a workspace ──────────────────────────────────────
  reindex: (workspaceId: string): Promise<{ indexed: number }> =>
    api.post(`/ai/reindex/${workspaceId}`).then((r) => r.data),

  // ── Get conversations list ────────────────────────────────────────────────
  //  docId passed  → scoped to that document
  //  docId=""      → workspace-wide conversations only
  //  docId omitted → all conversations
  getConversations: (
    workspaceId: string,
    docId?: string,
  ): Promise<Conversation[]> =>
    api
      .get(`/ai/conversations/${workspaceId}`, {
        params: docId !== undefined ? { docId } : undefined,
      })
      .then((r) => r.data),

  // ── Get messages for a conversation ──────────────────────────────────────
  getMessages: (
    workspaceId: string,
    conversationId: string,
  ): Promise<ConversationMessage[]> =>
    api
      .get(`/ai/conversations/${workspaceId}/${conversationId}/messages`)
      .then((r) => r.data),

  // ── Delete a conversation ─────────────────────────────────────────────────
  deleteConversation: (conversationId: string): Promise<{ deleted: true }> =>
    api.delete(`/ai/conversations/${conversationId}`).then((r) => r.data),
};
