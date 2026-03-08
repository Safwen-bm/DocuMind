"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { aiApi, ChatSource, Conversation, ConversationMessage } from "@/lib/ai.api"
import { cn } from "@/lib/utils"
import {
  X, Send, Loader2, Sparkles, User, FileText,
  ChevronRight, RotateCcw, BookOpen, MessageSquare,
  Trash2, Plus, ChevronLeft, Clock,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: ChatSource[]
  loading?: boolean
}

interface AiChatPanelProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  docId?: string
  docTitle?: string
  mode?: "document" | "workspace"
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiChatPanel({
  open,
  onClose,
  workspaceId,
  docId,
  docTitle,
  mode = "document",
}: AiChatPanelProps) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations("dashboard.ai")

  // View: "chat" | "history"
  const [view, setView] = useState<"chat" | "history">("chat")

  // Active conversation
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  // Summary
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  // History list
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Focus input when panel opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Load history when switching to history view ───────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const list = await aiApi.getConversations(workspaceId, docId)
      setConversations(list)
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false)
    }
  }, [workspaceId, docId])

  useEffect(() => {
    if (view === "history") loadHistory()
  }, [view, loadHistory])

  // ── Start a fresh conversation ────────────────────────────────────────────
  function startNew() {
    setConversationId(undefined)
    setMessages([])
    setSummary(null)
    setShowSummary(false)
    setView("chat")
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Load an existing conversation ─────────────────────────────────────────
  async function openConversation(conv: Conversation) {
    setView("chat")
    setConversationId(conv.id)
    setMessages([]) // show loading state

    try {
      const msgs = await aiApi.getMessages(workspaceId, conv.id)
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role === "UTILISATEUR" ? "user" : "assistant",
          content: m.contenu,
          sources: m.sources ?? undefined,
        }))
      )
    } catch {
      setMessages([])
    }
  }

  // ── Delete a conversation ─────────────────────────────────────────────────
  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await aiApi.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      // If it was the active one, reset
      if (conversationId === id) {
        setConversationId(undefined)
        setMessages([])
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null)
    }
  }

  // ── Send a message ────────────────────────────────────────────────────────
  async function handleSend() {
    const question = input.trim()
    if (!question || loading) return

    setInput("")
    setShowSummary(false)

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question }
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await aiApi.chat(workspaceId, question, docId, conversationId)

      // Save conversationId from first message
      if (!conversationId) setConversationId(res.conversationId)

      setMessages((prev) =>
        prev.map((m) =>
          m.loading
            ? { ...m, content: res.answer, sources: res.sources, loading: false }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, content: t("errorResponse"), loading: false } : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  async function handleSummarize() {
    if (!docId || summaryLoading) return
    setSummaryLoading(true)
    setShowSummary(true)
    setSummary(null)
    try {
      setSummary(await aiApi.summarize(docId))
    } catch {
      setSummary(t("summaryError"))
    } finally {
      setSummaryLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSourceClick(source: ChatSource) {
    router.push(`/${locale}/workspace/${workspaceId}/documents/${source.documentId}`)
  }

  const isEmpty = messages.length === 0 && !showSummary

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none">
                {t("title")}
              </p>
              {mode === "document" && docTitle && (
                <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-muted-foreground">
                  {docTitle}
                </p>
              )}
              {mode === "workspace" && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("workspaceMode")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Summarize — document mode only */}
            {mode === "document" && docId && view === "chat" && (
              <button
                onClick={handleSummarize}
                disabled={summaryLoading}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {summaryLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <BookOpen className="h-3.5 w-3.5" />
                }
                {t("summarize")}
              </button>
            )}

            {/* History toggle */}
            <button
              onClick={() => setView(view === "history" ? "chat" : "history")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "history"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={t("history")}
            >
              <Clock className="h-3.5 w-3.5" />
            </button>

            {/* New chat */}
            {view === "chat" && (
              <button
                onClick={startNew}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("newChat")}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Clear active chat */}
            {view === "chat" && messages.length > 0 && (
              <button
                onClick={startNew}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t("clearChat")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── History View ──────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("historyTitle")}
              </p>
              <button
                onClick={startNew}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                {t("newChat")}
              </button>
            </div>

            {historyLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!historyLoading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("historyEmpty")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("historyEmptyDesc")}</p>
              </div>
            )}

            {!historyLoading && conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                  conversationId === conv.id && "border-primary/40 bg-primary/8"
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate leading-snug">
                    {conv.titre}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {conv._count.messages} {t("messages")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(conv.dateMiseAJour).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  disabled={deletingId === conv.id}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/0 group-hover:text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  {deletingId === conv.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Chat View ─────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">

              {/* Empty state */}
              {isEmpty && (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {t("emptyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                    {mode === "document" ? t("emptyDescDocument") : t("emptyDescWorkspace")}
                  </p>

                  {/* Suggested questions */}
                  <div className="mt-6 w-full space-y-2">
                    {(mode === "document"
                      ? [t("suggest1Doc"), t("suggest2Doc"), t("suggest3Doc")]
                      : [t("suggest1Ws"), t("suggest2Ws"), t("suggest3Ws")]
                    ).map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary block */}
              {showSummary && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-primary">{t("summaryTitle")}</p>
                  </div>
                  {summaryLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("summaryGenerating")}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {summary}
                    </p>
                  )}
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}

                  <div className={cn("max-w-[80%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      )}
                    >
                      {msg.loading ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="space-y-1.5 px-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("sources")}
                        </p>
                        {msg.sources.map((source) => (
                          <button
                            key={source.documentId}
                            onClick={() => handleSourceClick(source)}
                            className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
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
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ──────────────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-border p-4">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === "document"
                      ? t("inputPlaceholderDocument")
                      : t("inputPlaceholderWorkspace")
                  }
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-32 [&::-webkit-scrollbar]:hidden"
                  style={{ fieldSizing: "content" } as any}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                {t("disclaimer")}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}