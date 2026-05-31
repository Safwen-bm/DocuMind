// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\dashboard\SearchModal.tsx

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { searchApi, SearchResult } from "@/lib/search.api"
import { cn } from "@/lib/utils"
import { Search, FileText, Folder, X, Loader2, Sparkles, Hash, Clock, ArrowRight } from "lucide-react"

interface SearchModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
}

export function SearchModal({ open, onClose, workspaceId }: SearchModalProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("dashboard.search")
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await searchApi.search(workspaceId, q)
      setResults(res)
      setSelectedIdx(0)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
      if (e.key === "Enter" && results[selectedIdx]) { e.preventDefault(); openDocument(results[selectedIdx]) }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, results, selectedIdx])

  function openDocument(result: SearchResult) {
    router.push(`/${locale}/workspace/${result.workspaceId}/documents/${result.documentId}`)
    onClose()
  }

  function highlightMatch(text: string, q: string) {
    if (!q.trim()) return <>{text}</>
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-primary rounded-sm px-0.5 font-medium not-italic">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-2xl -translate-x-1/2 px-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">

          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            {loading
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              : <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[420px] overflow-y-auto py-2">

            {!query && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 mb-3">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">{t("title")}</p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">{t("desc")}</p>
                <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Hash className="h-3 w-3" />{t("fulltext")}</span>
                  <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-primary" />{t("semantic")}</span>
                </div>
              </div>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("noResults", { query })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("noResultsDesc")}</p>
              </div>
            )}

            {results.length > 0 && (
              <div>
                <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {results.length > 1 ? t("resultsPlural", { count: results.length }) : t("results", { count: results.length })}
                </p>
                {results.map((result, idx) => (
                  <button
                    key={result.documentId}
                    onClick={() => openDocument(result)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      selectedIdx === idx ? "bg-primary/8" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {highlightMatch(result.titre, query)}
                        </p>
                        {result.matchType === "semantic" && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" />{t("aiBadge")}
                          </span>
                        )}
                        {result.matchType === "both" && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles className="h-2.5 w-2.5" />{t("aiBothBadge")}
                          </span>
                        )}
                      </div>
                      {result.excerpt && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                          {highlightMatch(result.excerpt, query)}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {result.dossierNom && (
                          <span className="flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{result.dossierNom}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(result.dateMiseAJour).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className={cn(
                      "mt-1 h-4 w-4 shrink-0 transition-opacity",
                      selectedIdx === idx ? "text-primary opacity-100" : "text-muted-foreground opacity-0",
                    )} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5">↑↓</kbd>{t("navigate")}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd>{t("open")}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">{t("shortcut")} {t("close")}</span>
          </div>
        </div>
      </div>
    </>
  )
}