"use client";

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\[docId]\_components\AiChatPanel.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  aiApi, ChatSource, Conversation, ConversationMessage,
} from "@/lib/ai.api";
import { documentApi } from "@/lib/document.api";
import { cn } from "@/lib/utils";
import {
  X, Send, Loader2, Sparkles, User, FileText,
  ChevronRight, RotateCcw, BookOpen, MessageSquare,
  Trash2, Plus, Clock, Wand2, CheckSquare, ListChecks,
  Key, LayoutTemplate, Download, AlertTriangle,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  loading?: boolean;
  isSummary?: boolean;
  isSimplify?: boolean;
  isAction?: string;
  isWarning?: boolean;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  docId?: string;
  docTitle?: string;
  mode?: "document" | "workspace";
}

const DOC_ACTIONS = [
  { id: "decisions" as const, labelFr: "Décisions",   icon: CheckSquare,   color: "text-blue-500",    bg: "bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/15" },
  { id: "tasks"     as const, labelFr: "Tâches",       icon: ListChecks,    color: "text-emerald-500", bg: "bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/15" },
  { id: "keypoints" as const, labelFr: "Points clés",  icon: Key,           color: "text-amber-500",   bg: "bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/15" },
  { id: "structure" as const, labelFr: "Structure",    icon: LayoutTemplate, color: "text-violet-500", bg: "bg-violet-500/8 border-violet-500/20 hover:bg-violet-500/15" },
] as const;

type DocActionId = (typeof DOC_ACTIONS)[number]["id"];

function isQuotaMessage(text: string) {
  return text.startsWith("⚠️");
}

// ── Simple markdown renderer ──────────────────────────────────────────────────
function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (/^[\*\-•]\s+/.test(line)) {
          const text = line.replace(/^[\*\-•]\s+/, "");
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              <span className="leading-relaxed">{renderInline(text)}</span>
            </div>
          );
        }
        if (/^\d+[\.\)]\s+/.test(line)) {
          const num = line.match(/^(\d+)/)?.[1];
          const text = line.replace(/^\d+[\.\)]\s+/, "");
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 font-medium opacity-70 tabular-nums">{num}.</span>
              <span className="leading-relaxed">{renderInline(text)}</span>
            </div>
          );
        }
        return <p key={i} className="leading-relaxed">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith("**"))
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    else if (match[0].startsWith("*"))
      parts.push(<em key={match.index}>{match[3]}</em>);
    else if (match[0].startsWith("["))
      parts.push(<a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer" className="underline opacity-80 hover:opacity-100">{match[4]}</a>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

export function AiChatPanel({
  open, onClose, workspaceId, docId, docTitle, mode = "document",
}: AiChatPanelProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("dashboard.ai");

  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [simplifyLoading, setSimplifyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<DocActionId | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [isIndexed, setIsIndexed] = useState<boolean | null>(null);
  const indexPollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open || mode !== "document" || !docId) return;
    async function checkIndexed() {
      try {
        const doc = await documentApi.getOne(docId!);
        setIsIndexed(doc.estIndexe ?? false);
        if (doc.estIndexe && indexPollRef.current) {
          clearInterval(indexPollRef.current);
          indexPollRef.current = null;
        }
      } catch { /* silent */ }
    }
    checkIndexed();
    indexPollRef.current = setInterval(checkIndexed, 4000);
    return () => {
      if (indexPollRef.current) { clearInterval(indexPollRef.current); indexPollRef.current = null; }
    };
  }, [open, mode, docId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await aiApi.getConversations(workspaceId, docId);
      setConversations(list);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, [workspaceId, docId]);

  useEffect(() => { if (view === "history") loadHistory(); }, [view, loadHistory]);

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
      setMessages(msgs.map((m: ConversationMessage) => ({
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

  function addNotIndexedWarning() {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "⚠️ Ce document n'est pas encore indexé. Ouvrez-le dans l'éditeur, ajoutez du contenu et sauvegardez avec Ctrl+S pour activer l'assistant IA.",
      isWarning: true,
    }]);
  }

  // ── Main send — plain REST, same as workspace mode ────────────────────────
  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    if (mode === "document" && isIndexed === false) {
      addNotIndexedWarning();
      return;
    }

    setInput("");
    setLoading(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      let res;
      if (mode === "workspace") {
        res = await aiApi.chatWorkspace(workspaceId, question, conversationId);
      } else {
        res = await aiApi.chat(workspaceId, question, docId, conversationId);
      }

      if (!conversationId) setConversationId(res.conversationId);

      setMessages(prev => prev.map(m =>
        m.loading
          ? {
              ...m,
              content: res.answer,
              loading: false,
              sources: res.sources,
              isWarning: isQuotaMessage(res.answer),
            }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading
          ? { ...m, content: t("errorResponse"), loading: false, isWarning: true }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  async function handleSummarize() {
    if (!docId || summaryLoading) return;
    setSummaryLoading(true);
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true, isSummary: true };
    setMessages(prev => [...prev, loadingMsg]);
    try {
      const result = await aiApi.summarize(docId);
      setMessages(prev => prev.map(m =>
        m.loading && m.isSummary ? { ...m, content: result, loading: false, isWarning: isQuotaMessage(result) } : m,
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading && m.isSummary ? { ...m, content: t("summaryError"), loading: false, isWarning: true } : m,
      ));
    } finally { setSummaryLoading(false); }
  }

  // ── Simplify ──────────────────────────────────────────────────────────────
  async function handleSimplify() {
    if (!docId || simplifyLoading) return;
    setSimplifyLoading(true);
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true, isSimplify: true };
    setMessages(prev => [...prev, loadingMsg]);
    try {
      const result = await aiApi.simplify(docId);
      setMessages(prev => prev.map(m =>
        m.loading && m.isSimplify ? { ...m, content: result, loading: false } : m,
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading && m.isSimplify ? { ...m, content: t("simplifyError"), loading: false, isWarning: true } : m,
      ));
    } finally { setSimplifyLoading(false); }
  }

  // ── Doc actions ───────────────────────────────────────────────────────────
  async function handleDocAction(actionId: DocActionId) {
    if (!docId || actionLoading) return;
    if (isIndexed === false) { addNotIndexedWarning(); return; }
    setActionLoading(actionId);
    const actionDef = DOC_ACTIONS.find(a => a.id === actionId)!;
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true, isAction: actionDef.labelFr };
    setMessages(prev => [...prev, loadingMsg]);
    try {
      const result = await aiApi.documentAction(docId, actionId);
      setMessages(prev => prev.map(m =>
        m.loading && m.isAction === actionDef.labelFr
          ? { ...m, content: result, loading: false, isWarning: isQuotaMessage(result) } : m,
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading && m.isAction === actionDef.labelFr
          ? { ...m, content: "Une erreur est survenue.", loading: false, isWarning: true } : m,
      ));
    } finally { setActionLoading(null); }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function shouldShowSources(msg: Message): boolean {
    if (!msg.sources || msg.sources.length === 0) return false;
    if (mode === "workspace") return true;
    return msg.sources.filter(s => s.documentId !== docId).length > 0;
  }

  function getVisibleSources(msg: Message): ChatSource[] {
    if (!msg.sources) return [];
    if (mode === "workspace") return msg.sources;
    return msg.sources.filter(s => s.documentId !== docId);
  }

  function handleSourceClick(source: ChatSource) {
    router.push(`/${locale}/workspace/${workspaceId}/documents/${source.documentId}`);
  }

  const isEmpty = messages.length === 0;
  const isBusy = loading || summaryLoading || simplifyLoading || !!actionLoading;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <div className={cn(
        "fixed right-0 top-0 z-40 flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full",
      )}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border">
          <div className="flex h-12 items-center justify-between px-4 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{t("title")}</p>
                {mode === "document" && docTitle && (
                  <p className="max-w-[150px] truncate text-[10px] text-muted-foreground leading-tight">{docTitle}</p>
                )}
                {mode === "workspace" && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{t("workspaceMode")}</p>
                )}
              </div>
              {mode === "document" && docId && isIndexed !== null && (
                isIndexed ? (
                  <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Prêt</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 shrink-0">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                    <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400">Indexation...</span>
                  </div>
                )
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => setView(view === "history" ? "chat" : "history")}
                className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  view === "history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}
                title={t("history")}>
                <Clock className="h-3.5 w-3.5" />
              </button>
              {view === "chat" && (
                <button onClick={startNew}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
                  title={t("newChat")}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              {view === "chat" && messages.length > 0 && (
                <button onClick={startNew}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {mode === "document" && docId && view === "chat" && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <button onClick={handleSummarize} disabled={isBusy}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
                {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                {t("summarize")}
              </button>
              <button onClick={handleSimplify} disabled={isBusy}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-500/10 hover:text-violet-700 disabled:opacity-50 dark:text-violet-400">
                {simplifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {t("simplify")}
              </button>
            </div>
          )}
        </div>

        {/* ── History View ──────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("historyTitle")}</p>
              <button onClick={startNew}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                <Plus className="h-3 w-3" />{t("newChat")}
              </button>
            </div>
            {historyLoading && <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {!historyLoading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("historyEmpty")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t("historyEmptyDesc")}</p>
              </div>
            )}
            {!historyLoading && conversations.map(conv => (
              <div key={conv.id} onClick={() => openConversation(conv)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5",
                  conversationId === conv.id && "border-primary/40 bg-primary/8",
                )}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate leading-snug">{conv.titre}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{conv._count.messages} {t("messages")}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(conv.dateMiseAJour).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={e => handleExportConversation(conv.id, e)} disabled={exportingId === conv.id}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-transparent group-hover:text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-50">
                  {exportingId === conv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                </button>
                <button onClick={e => deleteConversation(conv.id, e)} disabled={deletingId === conv.id}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-transparent group-hover:text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                  {deletingId === conv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Chat View ─────────────────────────────────────────────────────── */}
        {view === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
              {isEmpty && (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{t("emptyTitle")}</p>
                  <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                    {mode === "document" ? t("emptyDescDocument") : t("emptyDescWorkspace")}
                  </p>
                  <div className="mt-6 w-full space-y-2">
                    {(mode === "document"
                      ? [t("suggest1Doc"), t("suggest2Doc"), t("suggest3Doc")]
                      : [t("suggest1Ws"), t("suggest2Ws"), t("suggest3Ws")]
                    ).map((suggestion, i) => (
                      <button key={i} onClick={() => setInput(suggestion)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                      msg.isWarning ? "bg-orange-500/10" : msg.isSimplify ? "bg-violet-500/10" : "bg-primary/10",
                    )}>
                      {msg.isWarning
                        ? <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        : msg.isSimplify
                          ? <Wand2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  )}

                  <div className={cn("max-w-[80%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                    {(msg.isSimplify || msg.isSummary || msg.isAction) && !msg.loading && (
                      <div className="flex items-center gap-1.5 px-1">
                        {msg.isSummary ? <BookOpen className="h-2.5 w-2.5 text-primary" />
                          : msg.isSimplify ? <Wand2 className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                          : <Sparkles className="h-2.5 w-2.5 text-primary" />}
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {msg.isSummary ? t("summaryTitle") : msg.isSimplify ? t("simplifyTitle") : msg.isAction}
                        </p>
                      </div>
                    )}

                    <div className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : msg.isWarning
                          ? "border border-orange-500/20 bg-orange-500/5 text-orange-700 dark:text-orange-300 rounded-tl-sm"
                          : msg.isSimplify
                            ? "border border-violet-500/20 bg-violet-500/5 text-foreground rounded-tl-sm"
                            : "bg-muted text-foreground rounded-tl-sm",
                    )}>
                      {msg.loading ? (
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <MarkdownText content={msg.content} />
                      )}
                    </div>

                    {shouldShowSources(msg) && (
                      <div className="space-y-1.5 px-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("sources")}</p>
                        {getVisibleSources(msg).map(source => (
                          <button key={source.documentId} onClick={() => handleSourceClick(source)}
                            className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">{source.titre}</p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground italic">&quot;{source.excerpt}&quot;</p>
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

            {/* ── Input area ────────────────────────────────────────────────── */}
            <div className="shrink-0 border-t border-border p-4 space-y-3">
              {mode === "document" && docId && (
                <div className="grid grid-cols-2 gap-1.5">
                  {DOC_ACTIONS.map(action => {
                    const Icon = action.icon;
                    const isLoading = actionLoading === action.id;
                    return (
                      <button key={action.id} onClick={() => handleDocAction(action.id)} disabled={isBusy}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                          action.bg,
                        )}>
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Icon className={cn("h-3 w-3", action.color)} />}
                        <span className="text-foreground">{isLoading ? "..." : action.labelFr}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === "document" ? t("inputPlaceholderDocument") : t("inputPlaceholderWorkspace")}
                  rows={1}
                  disabled={isBusy}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-32 [&::-webkit-scrollbar]:hidden"
                  style={{ fieldSizing: "content" } as any}
                />
                <button onClick={handleSend} disabled={!input.trim() || isBusy}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">{t("disclaimer")}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}