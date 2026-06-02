// frontend/src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/_components/DocumentGrid.tsx

"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations, useLocale } from "next-intl"
import { documentApi } from "@/lib/document.api"
import { aiApi } from "@/lib/ai.api"
import { Document, Dossier } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FileText, Folder, Plus, Star, Trash2,
  Loader2, Clock, Users, MoreHorizontal,
  MoveRight, FolderPlus, Download,
  File, FileSpreadsheet, Sparkles, Send,
  X, GitCompare, Layers,
  User, ChevronRight, Tag, Eye, Edit2,
  AlertCircle, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { ChatSource } from "@/lib/ai.api"

// ── Tag color palette ─────────────────────────────────────────────────────────
const TAG_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
]

function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

// ── Helper: strip existing suffix and add (1) — backend will bump further ─────
function buildSuffixedTitle(titre: string): string {
  const base = titre.replace(/\s*\(\d+\)$/, "").trim()
  return `${base} (1)`
}

// ── "Vu par" avatar stack ─────────────────────────────────────────────────────
function ViewerAvatars({ views }: { views: Array<{ userId: string; user: { nom: string; avatarUrl: string | null } }> }) {
  if (!views || views.length === 0) return null
  const shown = views.slice(0, 4)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Eye className="h-3 w-3 text-muted-foreground/60" />
          <div className="flex -space-x-1.5">
            {shown.map((v, i) => (
              <div
                key={v.userId}
                style={{ zIndex: shown.length - i }}
                className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-bold text-muted-foreground overflow-hidden"
              >
                {v.user.avatarUrl
                  ? <img src={v.user.avatarUrl} alt={v.user.nom} className="h-full w-full object-cover" />
                  : v.user.nom.charAt(0).toUpperCase()
                }
              </div>
            ))}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium mb-0.5">Vu par</p>
        {shown.map(v => <p key={v.userId}>{v.user.nom}</p>)}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Export dropdown ───────────────────────────────────────────────────────────
function ExportDropdown({ docId, docTitre }: { docId: string; docTitre: string }) {
  const t = useTranslations("dashboard.documents")
  const [loadingFormat, setLoadingFormat] = useState<"pdf" | "docx" | "excel" | null>(null)

  async function handleExport(format: "pdf" | "docx" | "excel") {
    setLoadingFormat(format)
    try {
      if (format === "pdf")   await documentApi.exportPdf(docId, docTitre)
      if (format === "docx")  await documentApi.exportDocx(docId, docTitre)
      if (format === "excel") await documentApi.exportExcel(docId, docTitre)
      toast.success(t("exportSuccess"))
    } catch {
      toast.error(t("exportError"))
    } finally {
      setLoadingFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent" title={t("download")}>
          {loadingFormat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("downloadAs")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={loadingFormat !== null} className="gap-2 cursor-pointer">
          <File className="h-3.5 w-3.5 text-red-500" />PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("docx")} disabled={loadingFormat !== null} className="gap-2 cursor-pointer">
          <FileText className="h-3.5 w-3.5 text-blue-500" />Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")} disabled={loadingFormat !== null} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Rename dialog ─────────────────────────────────────────────────────────────
function RenameDocDialog({
  doc,
  open,
  onClose,
  workspaceId,
}: {
  doc: Document
  open: boolean
  onClose: () => void
  workspaceId: string
}) {
  const t = useTranslations("dashboard.documents")
  const queryClient = useQueryClient()
  const [name, setName] = useState(doc.titre)
  // null  = no error
  // string = conflicting name (show banner + auto-rename button)
  const [conflictName, setConflictName] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(doc.titre)
      setConflictName(null)
    }
  }, [open, doc.titre])

  const renameMutation = useMutation({
    mutationFn: (titre: string) => documentApi.update(doc.id, { titre }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] })
      onClose()
    },
    onError: (err: any) => {
      const status = err?.response?.status ?? err?.status
      if (status === 409) {
        // Show conflict banner — stay open so user can act
        setConflictName(name.trim())
      } else {
        toast.error(t("rename.genericError"))
        onClose()
      }
    },
  })

  function handleSubmit(titre: string) {
    const trimmed = titre.trim()
    if (!trimmed || trimmed === doc.titre) return
    setConflictName(null)
    renameMutation.mutate(trimmed)
  }

  // Auto-suffix: strip existing (N) and add (1); backend bumps if (1) exists
  function handleAutoRename() {
    const suffixed = buildSuffixedTitle(name)
    setName(suffixed)
    setConflictName(null)
    renameMutation.mutate(suffixed)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rename.title")}</DialogTitle>
          <DialogDescription>{t("rename.desc")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(name) }}
          className="mt-2 space-y-3"
        >
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              // Clear conflict banner as user types a new name
              if (conflictName) setConflictName(null)
            }}
            autoFocus
            placeholder={t("rename.placeholder")}
            className={cn(conflictName && "border-destructive focus-visible:ring-destructive/30")}
          />

          {/* ── Conflict banner with auto-rename option ── */}
          {conflictName && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
                <p className="text-xs text-destructive leading-snug">
                  {t("rename.conflictError", { name: conflictName })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoRename}
                disabled={renameMutation.isPending}
                className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {renameMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />
                }
                {t("rename.autoRename")}
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("rename.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={renameMutation.isPending || !name.trim() || name.trim() === doc.titre}
            >
              {renameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("rename.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Multi-doc chat modal ──────────────────────────────────────────────────────
interface MultiDocMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: ChatSource[]
  loading?: boolean
}

function MultiDocChatModal({
  open, onClose, workspaceId, selectedDocs, initialAction,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  selectedDocs: Document[]
  initialAction?: "compare" | "synthesize" | "ask"
}) {
  const locale = useLocale()
  const router = useRouter()
  const [messages, setMessages] = useState<MultiDocMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && initialAction && messages.length === 0) {
      const autoQ: Record<string, string> = {
        compare:    `Compare ces ${selectedDocs.length} documents et explique leurs différences et similitudes : ${selectedDocs.map(d => `"${d.titre}"`).join(", ")}`,
        synthesize: `Fais une synthèse complète de ces ${selectedDocs.length} documents : ${selectedDocs.map(d => `"${d.titre}"`).join(", ")}`,
        ask:        "",
      }
      const q = autoQ[initialAction]
      if (q) setTimeout(() => sendMessage(q), 300)
      else setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open, initialAction])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return
    setInput("")
    const userMsg: MultiDocMessage = { id: crypto.randomUUID(), role: "user", content: question }
    const loadingMsg: MultiDocMessage = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)
    try {
      const res = await aiApi.chatMultiDoc(workspaceId, question, selectedDocs.map(d => d.id), conversationId)
      if (!conversationId) setConversationId(res.conversationId)
      setMessages(prev => prev.map(m => m.loading ? { ...m, content: res.answer, sources: res.sources, loading: false } : m))
    } catch {
      setMessages(prev => prev.map(m => m.loading ? { ...m, content: "Une erreur est survenue.", loading: false } : m))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  function handleClose() { setMessages([]); setInput(""); setConversationId(undefined); onClose() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[80vh] max-w-2xl flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">IA — {selectedDocs.length} documents sélectionnés</DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                {selectedDocs.map(d => d.titre).join(" · ")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <Layers className="h-10 w-10 text-primary/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Posez une question sur ces {selectedDocs.length} documents</p>
              <p className="text-xs text-muted-foreground/60 mt-1">L'IA utilisera uniquement ces documents comme source</p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {[
                  `Quelles sont les différences entre ces documents ?`,
                  `Résume ces ${selectedDocs.length} documents en un paragraphe`,
                  `Quels sont les points communs ?`,
                ].map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className="max-w-[80%] space-y-2">
                <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                  {msg.loading ? (
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Sources</p>
                    {msg.sources.map(source => (
                      <button key={source.documentId}
                        onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${source.documentId}`)}
                        className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{source.titre}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground italic">"{source.excerpt}"</p>
                        </div>
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
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

        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 focus-within:border-primary/50 focus-within:bg-background transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question sur ces documents..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-32 [&::-webkit-scrollbar]:hidden"
              style={{ fieldSizing: "content" } as any}
            />
            <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main DocumentGrid component ───────────────────────────────────────────────
interface DocumentGridProps {
  workspaceId: string
  locale: string
  documents: Document[] | undefined
  folders: Dossier[]
  selectedFolderId: string | null
  selectedFolderName: string | undefined
  isLoading: boolean
  canEdit: boolean
  onCreateDoc: () => void
  onCreateFolder: () => void
  activeTag?: string | null
  onTagClick?: (tag: string | null) => void
}

export function DocumentGrid({
  workspaceId, locale, documents, folders, selectedFolderId,
  selectedFolderName, isLoading, canEdit, onCreateDoc, onCreateFolder,
  activeTag, onTagClick,
}: DocumentGridProps) {
  const t = useTranslations("dashboard.documents")
  const router = useRouter()
  const queryClient = useQueryClient()

  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [renameDoc, setRenameDoc] = useState<Document | null>(null)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [multiChatOpen, setMultiChatOpen] = useState(false)
  const [multiChatAction, setMultiChatAction] = useState<"compare" | "synthesize" | "ask">("ask")

  function toggleDocSelection(docId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }

  function clearSelection() { setSelectedDocIds(new Set()) }

  function openMultiChat(action: "compare" | "synthesize" | "ask") {
    setMultiChatAction(action)
    setMultiChatOpen(true)
  }

  const selectedDocsData = (documents ?? []).filter(d => selectedDocIds.has(d.id))
  const displayedDocuments = activeTag
    ? (documents ?? []).filter(d => d.tags?.includes(activeTag))
    : documents
  const allTags = Array.from(new Set((documents ?? []).flatMap(d => d.tags ?? []))).sort()

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
      setDeleteDoc(null)
    },
  })

  const toggleFavoriMutation = useMutation({
    mutationFn: (id: string) => documentApi.toggleFavori(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
    },
  })

  const moveDocMutation = useMutation({
    mutationFn: ({ id, dossierId }: { id: string; dossierId: string | null }) =>
      documentApi.moveDocument(id, dossierId),
    onSuccess: (updatedDoc) => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      const original = documents?.find(d => d.id === updatedDoc.id)
      if (original && original.titre !== updatedDoc.titre) {
        toast.info(t("moveAutoRenamed", { name: updatedDoc.titre }))
      }
    },
    onError: () => {
      toast.error(t("moveError"))
    },
  })

  const moveTargetFolders = folders.filter(f => f.id !== selectedFolderId)

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{selectedFolderName ?? t("allDocuments")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{displayedDocuments?.length ?? 0} {t("documentsCount")}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs lg:hidden" onClick={onCreateFolder}>
              <FolderPlus className="h-3.5 w-3.5" />{t("folder")}
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={onCreateDoc}>
              <Plus className="h-3.5 w-3.5" />{t("newDocument")}
            </Button>
          </div>
        )}
      </div>

      {/* ── Tag filter bar ── */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-6 py-2.5 border-b border-border [&::-webkit-scrollbar]:hidden">
          <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <button
            onClick={() => onTagClick?.(null)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              !activeTag ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            Tous
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => onTagClick?.(activeTag === tag ? null : tag)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeTag === tag ? "bg-primary text-primary-foreground" : cn("hover:opacity-80", getTagColor(tag))
              )}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : !displayedDocuments || displayedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {activeTag ? t("noDocsWithTag", { tag: activeTag }) : selectedFolderName ? t("noDocsInFolder", { folder: selectedFolderName }) : t("noDocsYet")}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {canEdit ? t("createFirstDesc") : t("readOnlyDesc")}
            </p>
            {canEdit && !activeTag && (
              <Button className="mt-5 gap-2" onClick={onCreateDoc}>
                <Plus className="h-4 w-4" />{t("createDoc")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedDocuments.map(doc => {
              const isSelected = selectedDocIds.has(doc.id)
              return (
                <div
                  key={doc.id}
                  className={cn(
                    "group relative flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:shadow-primary/5 cursor-pointer",
                    isSelected ? "border-primary/60 bg-primary/5 shadow-sm shadow-primary/10" : "border-border hover:border-primary/30"
                  )}
                  onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)}
                >
                  {/* Checkbox */}
                  <div
                    className={cn("absolute left-2 top-2 transition-opacity", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                    onClick={e => toggleDocSelection(doc.id, e)}
                  >
                    <div className={cn("flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-border bg-background hover:border-primary")}>
                      {isSelected && (
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex items-start gap-3 mb-3 mt-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {doc.titre}
                      </p>
                      {doc.dossier && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Folder className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{doc.dossier.nom}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tag badges */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2" onClick={e => e.stopPropagation()}>
                      {doc.tags.slice(0, 3).map(tag => (
                        <button key={tag} onClick={() => onTagClick?.(activeTag === tag ? null : tag)}
                          className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-70", getTagColor(tag))}>
                          {tag}
                        </button>
                      ))}
                      {doc.tags.length > 3 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                              +{doc.tags.length - 3}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="border border-border bg-card text-card-foreground shadow-md max-w-[200px] p-2"
                          >
                            <div className="flex flex-wrap gap-1">
                              {doc.tags.slice(3).map(tag => (
                                <span key={tag} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", getTagColor(tag))}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {doc.author.nom.split(" ")[0]}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(doc.dateMiseAJour), { addSuffix: true })}
                    </span>
                    {doc.views && doc.views.length > 0 && <ViewerAvatars views={doc.views as any} />}
                  </div>

                  {/* Action overlay */}
                  <div
                    className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleFavoriMutation.mutate(doc.id)}
                          className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-accent", doc.isFavori ? "text-yellow-500" : "text-muted-foreground")}
                        >
                          <Star className={cn("h-3.5 w-3.5", doc.isFavori && "fill-yellow-500")} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {doc.isFavori ? t("tooltips.unstar") : t("tooltips.star")}
                      </TooltipContent>
                    </Tooltip>

                    <ExportDropdown docId={doc.id} docTitre={doc.titre} />

                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">

                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => setRenameDoc(doc)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            {t("tooltips.rename")}
                          </DropdownMenuItem>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                              <MoveRight className="h-3.5 w-3.5" />{t("tooltips.move")}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                              {doc.dossierId && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer"
                                  onClick={() => moveDocMutation.mutate({ id: doc.id, dossierId: null })}
                                >
                                  <FileText className="h-3.5 w-3.5" />{t("moveToRoot")}
                                </DropdownMenuItem>
                              )}
                              {moveTargetFolders.map(f => (
                                <DropdownMenuItem
                                  key={f.id}
                                  className="gap-2 cursor-pointer"
                                  onClick={() => moveDocMutation.mutate({ id: doc.id, dossierId: f.id })}
                                >
                                  <Folder className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{f.nom}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => setDeleteDoc(doc)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />{t("tooltips.delete")}
                          </DropdownMenuItem>

                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Floating multi-doc bar ── */}
      {selectedDocIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex items-center gap-2 border-r border-border pr-3 mr-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{selectedDocIds.size}</div>
              <span className="text-xs font-medium text-foreground">docs sélectionnés</span>
            </div>
            <button onClick={() => openMultiChat("compare")}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all">
              <GitCompare className="h-3.5 w-3.5 text-blue-500" />Comparer
            </button>
            <button onClick={() => openMultiChat("synthesize")}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all">
              <Layers className="h-3.5 w-3.5 text-emerald-500" />Synthétiser
            </button>
            <button onClick={() => openMultiChat("ask")}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Sparkles className="h-3.5 w-3.5" />Poser une question
            </button>
            <button onClick={clearSelection}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <MultiDocChatModal
        open={multiChatOpen}
        onClose={() => setMultiChatOpen(false)}
        workspaceId={workspaceId}
        selectedDocs={selectedDocsData}
        initialAction={multiChatAction}
      />

      {/* ── Rename dialog ── */}
      {renameDoc && (
        <RenameDocDialog
          doc={renameDoc}
          open={!!renameDoc}
          onClose={() => setRenameDoc(null)}
          workspaceId={workspaceId}
        />
      )}

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteDocModal.title")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteDoc?.titre}</span>{" "}
              {t("deleteDocModal.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>{t("deleteDocModal.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDoc && deleteDocMutation.mutate(deleteDoc.id)}
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteDocModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}