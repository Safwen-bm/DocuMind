"use client";

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\ai\_components\WorkspaceChat.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { aiApi, ChatSource, Conversation } from "@/lib/ai.api";
import { cn } from "@/lib/utils";
import {
  Sparkles, Send, Loader2, User, FileText,
  ChevronRight, RotateCcw, MessageSquare,
  Trash2, Plus, Clock, Bot, Download
} from "lucide-react";
import { SecretaryChips } from "./SecretaryChips";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  loading?: boolean;
  isMeta?: boolean; // true when backend answered from DB (not RAG)
}

interface WorkspaceChatProps {
  workspaceId: string;
  workspaceName: string;
}

export function WorkspaceChat({ workspaceId, workspaceName }: WorkspaceChatProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("dashboard.ai");

  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await aiApi.getConversations(workspaceId, "");
      setConversations(list);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, [workspaceId]);

  useEffect(() => {
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  function startNew() {
    setConversationId(undefined);
    setMessages([]);
    setView("chat");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function openConversation(conv: Conversation) {
    setView("chat");
    setConversationId(conv.id);
    setMessages([]);
    try {
      const msgs = await aiApi.getMessages(workspaceId, conv.id);
      setMessages(msgs.map(m => ({
        id: m.id,
        role: m.role === "UTILISATEUR" ? "user" : "assistant",
        content: m.contenu,
        sources: m.sources ?? undefined,
      })));
    } catch { setMessages([]); }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await aiApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) { setConversationId(undefined); setMessages([]); }
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  }

  async function handleExportConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExportingId(id);
    try { await aiApi.exportConversation(id); }
    catch { /* silent */ }
    finally { setExportingId(null); }
  }

  async function handleSend(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      // The backend now classifies the intent automatically.
      // If it's a workspace meta question (who joined, recent docs, stats),
      // the backend answers from the DB directly.
      // If it's a document question, it uses the RAG pipeline.
      const res = await aiApi.chatWorkspace(workspaceId, question, conversationId);
      if (!conversationId) setConversationId(res.conversationId);

      setMessages(prev => prev.map(m =>
        m.loading
          ? { ...m, content: res.answer, sources: res.sources, loading: false, isMeta: res.isMeta }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading ? { ...m, content: t("errorResponse"), loading: false } : m
      ));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              Secrétaire IA
            </h1>
            <p className="text-xs text-muted-foreground">
              {workspaceName} · Posez des questions sur vos documents ou votre équipe
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setView(view === "history" ? "chat" : "history")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                view === "history"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {t("history")}
            </button>

            <button onClick={startNew}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />{t("newChat")}
            </button>

            {messages.length > 0 && view === "chat" && (
              <button onClick={startNew}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <RotateCcw className="h-3 w-3" />{t("clearChat")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── History View ─────────────────────────────────────────────────── */}
      {view === "history" && (
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          <div className="mx-auto max-w-2xl px-6 py-6 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {t("historyTitle")}
            </p>

            {historyLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!historyLoading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">{t("historyEmpty")}</p>
                <button onClick={startNew}
                  className="mt-6 flex items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
                  <Plus className="h-4 w-4" />{t("newChat")}
                </button>
              </div>
            )}

            {!historyLoading && conversations.map(conv => (
              <div key={conv.id} onClick={() => openConversation(conv)}
                className={cn(
                  "group relative flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5",
                  conversationId === conv.id && "border-primary/40 bg-primary/8",
                )}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{conv.titre}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground">{conv._count.messages} {t("messages")}</span>
                    <span className="text-xs text-muted-foreground/50">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(conv.dateMiseAJour).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={e => handleExportConversation(conv.id, e)}
                  disabled={exportingId === conv.id}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                >
                  {exportingId === conv.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                </button>
                <button onClick={e => deleteConversation(conv.id, e)} disabled={deletingId === conv.id}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                  {deletingId === conv.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat View ────────────────────────────────────────────────────── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {isEmpty ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Votre Secrétaire IA
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                  Posez des questions sur vos documents, ou demandez des informations sur votre équipe et l'activité du workspace.
                </p>

                {/* Secretary chips — categorized quick questions */}
                <SecretaryChips onSelect={q => { setInput(q); handleSend(q); }} />
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1",
                        msg.isMeta ? "bg-emerald-500/10" : "bg-primary/10"
                      )}>
                        {msg.isMeta
                          ? <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          : <Sparkles className="h-4 w-4 text-primary" />}
                      </div>
                    )}

                    <div className={cn("max-w-[75%] space-y-3", msg.role === "user" ? "items-end" : "items-start")}>
                      {/* Meta badge */}
                      {msg.isMeta && !msg.loading && (
                        <div className="flex items-center gap-1.5 px-1">
                          <Bot className="h-2.5 w-2.5 text-emerald-600" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Info workspace
                          </span>
                        </div>
                      )}

                      <div className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : msg.isMeta
                            ? "border border-emerald-500/20 bg-emerald-500/5 text-foreground rounded-tl-sm"
                            : "bg-muted text-foreground rounded-tl-sm",
                      )}>
                        {msg.loading ? (
                          <div className="flex items-center gap-2 py-0.5">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                              <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="space-y-2">
                          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("sources")}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {msg.sources.map(source => (
                              <button key={source.documentId}
                                onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${source.documentId}`)}
                                className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-primary/5">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">{source.titre}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground italic">"{source.excerpt}"</p>
                                </div>
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Input ──────────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border bg-background p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 focus-within:border-primary/50 focus-within:bg-background transition-colors shadow-sm">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez une question sur vos documents ou votre équipe..."
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-36 [&::-webkit-scrollbar]:hidden"
                  style={{ fieldSizing: "content" } as any}
                />
                <button onClick={() => handleSend()} disabled={!input.trim() || loading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                {t("disclaimer")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}