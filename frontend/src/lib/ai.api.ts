// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\lib\ai.api.ts

import api from "./api";

export interface ChatSource {
  documentId: string;
  titre: string;
  excerpt: string;
  chunkIndex?: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  conversationId: string;
  isMeta?: boolean;
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
  // ── Standard RAG chat ─────────────────────────────────────────────────────
  chat: (
    workspaceId: string,
    question: string,
    docId?: string,
    conversationId?: string,
  ): Promise<ChatResponse> =>
    api.post("/ai/chat", { workspaceId, question, docId, conversationId }).then(r => r.data),

  // ── Multi-doc RAG chat ────────────────────────────────────────────────────
  chatMultiDoc: (
    workspaceId: string,
    question: string,
    documentIds: string[],
    conversationId?: string,
  ): Promise<ChatResponse> =>
    api.post("/ai/chat-multi", { workspaceId, question, documentIds, conversationId }).then(r => r.data),

  // ── Workspace secretary ───────────────────────────────────────────────────
  chatWorkspace: (
    workspaceId: string,
    question: string,
    conversationId?: string,
  ): Promise<ChatResponse> =>
    api.post("/ai/chat-workspace", { workspaceId, question, conversationId }).then(r => r.data),

  // ── Summarize ─────────────────────────────────────────────────────────────
  summarize: (docId: string): Promise<string> =>
    api.post(`/ai/summarize/${docId}`).then(r => r.data),

  // ── Simplify ──────────────────────────────────────────────────────────────
  simplify: (docId: string): Promise<string> =>
    api.post(`/ai/simplify/${docId}`).then(r => r.data),

  // ── Inline rewrite ────────────────────────────────────────────────────────
  inlineRewrite: (
    text: string,
    action: "improve" | "simplify" | "rephrase" | "translate",
  ): Promise<string> =>
    api.post("/ai/inline", { text, action }).then(r => r.data.result),

  // ── Document action buttons ───────────────────────────────────────────────
  documentAction: (
    docId: string,
    action: "decisions" | "tasks" | "keypoints" | "structure",
  ): Promise<string> =>
    api.post(`/ai/actions/${docId}`, { action }).then(r => r.data.result),

  // ── Generate document ─────────────────────────────────────────────────────
  generateDocument: (
    workspaceId: string,
    titre: string,
    description: string,
    dossierId?: string,
  ): Promise<{ documentId: string; content: any }> =>
    api.post("/ai/generate", { workspaceId, titre, description, dossierId }).then(r => r.data),

  // ── Reindex ───────────────────────────────────────────────────────────────
  reindex: (workspaceId: string): Promise<{ indexed: number }> =>
    api.post(`/ai/reindex/${workspaceId}`).then(r => r.data),

  // ── Conversations ─────────────────────────────────────────────────────────
  getConversations: (workspaceId: string, docId?: string): Promise<Conversation[]> =>
    api.get(`/ai/conversations/${workspaceId}`, {
      params: docId !== undefined ? { docId } : undefined,
    }).then(r => r.data),

  getMessages: (workspaceId: string, conversationId: string): Promise<ConversationMessage[]> =>
    api.get(`/ai/conversations/${workspaceId}/${conversationId}/messages`).then(r => r.data),

  deleteConversation: (conversationId: string): Promise<{ deleted: true }> =>
    api.delete(`/ai/conversations/${conversationId}`).then(r => r.data),

  // ── NEW: Export conversation as PDF ──────────────────────────────────────
  // Uses fetch directly (same pattern as document exports) to handle blob response
  exportConversation: async (conversationId: string): Promise<void> => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/ai/conversations/${conversationId}/export`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};