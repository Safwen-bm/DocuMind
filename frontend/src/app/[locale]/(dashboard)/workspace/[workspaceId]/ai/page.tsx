"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace.api";
import { aiApi, ChatSource, Conversation } from "@/lib/ai.api";
import { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Send,
  Loader2,
  User,
  FileText,
  ChevronRight,
  RotateCcw,
  MessageSquare,
  Trash2,
  Plus,
  Clock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  loading?: boolean;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkspaceAiPage() {
  const params = useParams();
  const locale = useLocale();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const t = useTranslations("dashboard.ai");

  const [view, setView] = useState<"chat" | "history">("chat");

  // Active conversation
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // History
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Load history ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      // docId="" = workspace-wide conversations only
      const list = await aiApi.getConversations(workspaceId, "");
      setConversations(list);
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  // ── Start fresh ───────────────────────────────────────────────────────────
  function startNew() {
    setConversationId(undefined);
    setMessages([]);
    setView("chat");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Open existing conversation ────────────────────────────────────────────
  async function openConversation(conv: Conversation) {
    setView("chat");
    setConversationId(conv.id);
    setMessages([]);
    try {
      const msgs = await aiApi.getMessages(workspaceId, conv.id);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role === "UTILISATEUR" ? "user" : "assistant",
          content: m.contenu,
          sources: m.sources ?? undefined,
        })),
      );
    } catch {
      setMessages([]);
    }
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await aiApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        setConversationId(undefined);
        setMessages([]);
      }
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      // No docId = workspace-wide search
      const res = await aiApi.chat(
        workspaceId,
        question,
        undefined,
        conversationId,
      );
      if (!conversationId) setConversationId(res.conversationId);

      setMessages((prev) =>
        prev.map((m) =>
          m.loading
            ? {
                ...m,
                content: res.answer,
                sources: res.sources,
                loading: false,
              }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, content: t("errorResponse"), loading: false } : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t("pageTitle")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {workspace?.nom} · {t("pageSub")}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* History toggle */}
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

            {/* New chat */}
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newChat")}
            </button>

            {/* Clear current */}
            {messages.length > 0 && view === "chat" && (
              <button
                onClick={startNew}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                {t("clearChat")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── History View ───────────────────────────────────────────────────── */}
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
                <p className="text-sm font-medium text-muted-foreground">
                  {t("historyEmpty")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t("historyEmptyDesc")}
                </p>
                <button
                  onClick={startNew}
                  className="mt-6 flex items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t("newChat")}
                </button>
              </div>
            )}

            {!historyLoading &&
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={cn(
                    "group relative flex items-start gap-4 rounded-2xl border border-border bg-card px-4 py-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                    conversationId === conv.id &&
                      "border-primary/40 bg-primary/8",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-snug">
                      {conv.titre}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {conv._count.messages} {t("messages")}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        ·
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.dateMiseAJour).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    disabled={deletingId === conv.id}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/0 group-hover:text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    {deletingId === conv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Chat View ──────────────────────────────────────────────────────── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {isEmpty ? (
              /* Empty state */
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {t("pageEmptyTitle")}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                  {t("pageEmptyDesc")}
                </p>
                <div className="mt-8 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {[t("suggest1Ws"), t("suggest2Ws"), t("suggest3Ws")].map(
                    (q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground hover:shadow-sm"
                      >
                        {q}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-4",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[75%] space-y-3",
                        msg.role === "user" ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm",
                        )}
                      >
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

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="space-y-2">
                          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("sources")}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {msg.sources.map((source) => (
                              <button
                                key={source.documentId}
                                onClick={() =>
                                  router.push(
                                    `/${locale}/workspace/${workspaceId}/documents/${source.documentId}`,
                                  )
                                }
                                className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {source.titre}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                                    {source.excerpt}
                                  </p>
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

          {/* ── Input ────────────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-border bg-background p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3 focus-within:border-primary/50 focus-within:bg-background transition-colors shadow-sm">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("inputPlaceholderWorkspace")}
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-36 [&::-webkit-scrollbar]:hidden"
                  style={{ fieldSizing: "content" } as any}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
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
