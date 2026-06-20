"use client"

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\[docId]\_components\InlineAiMenu.tsx

import { useState, useEffect, useRef, useCallback } from "react"
import { Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  Wand2, Sparkles, Languages, RefreshCw, Loader2, X, Check, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { aiApi, InlineRewriteAction } from "@/lib/ai.api"

interface InlineAiMenuProps {
  editor: Editor
  workspaceId: string
}

interface MenuPosition {
  top: number
  left: number
  selectionBottom: number // bottom of selection, used to decide above/below
}

type ActionId = "improve" | "simplify" | "rephrase" | "translate"

// How long the user must hold a selection before the menu appears (ms)
// Prevents it from popping up on every quick click-drag
const INTENT_DELAY_MS = 600

export function InlineAiMenu({ editor, workspaceId }: InlineAiMenuProps) {
  const t = useTranslations("dashboard.editor.inlineAi")

  // ── Translated action lists (rebuilt each render so language switches work) ─
  const ACTIONS: {
    id: ActionId
    label: string
    icon: React.ElementType
    color: string
  }[] = [
    { id: "improve",   label: t("improve"),   icon: Sparkles,   color: "text-blue-500" },
    { id: "simplify",  label: t("simplify"),  icon: Wand2,      color: "text-violet-500" },
    { id: "rephrase",  label: t("rephrase"),  icon: RefreshCw,  color: "text-emerald-500" },
    { id: "translate", label: t("translate"), icon: Languages,  color: "text-amber-500" },
  ]

  const TRANSLATE_OPTIONS: { id: InlineRewriteAction; label: string; flag: string }[] = [
    { id: "translate_en", label: t("translateEn"), flag: "🇬🇧" },
    { id: "translate_fr", label: t("translateFr"), flag: "🇫🇷" },
    { id: "translate_ar", label: t("translateAr"), flag: "🇸🇦" },
  ]

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<
    "hidden"      // nothing shown
    | "pill"      // small ✨ pill floating below selection, non-blocking
    | "menu"      // full action menu
    | "preview"   // result preview
  >("hidden")

  const [position, setPosition]       = useState<MenuPosition>({ top: 0, left: 0, selectionBottom: 0 })
  const [loading, setLoading]         = useState<InlineRewriteAction | null>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [previewAction, setPreviewAction] = useState<InlineRewriteAction | null>(null)
  const [selectedText, setSelectedText]   = useState("")
  const [translateOpen, setTranslateOpen] = useState(false)

  const menuRef     = useRef<HTMLDivElement>(null)
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pillRef     = useRef<HTMLButtonElement>(null)

  // ── Position calculation ───────────────────────────────────────────────────
  const calcPosition = useCallback((): MenuPosition | null => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null
    const range = selection.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    if (!rect.width) return null

    const MENU_WIDTH = 300
    const GAP        = 6

    // Center horizontally on selection, clamp to viewport
    let left = rect.left + rect.width / 2 - MENU_WIDTH / 2
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))

    // Pill sits BELOW the selection, so it never overlaps the text
    const pillTop = rect.bottom + window.scrollY + GAP

    return {
      top: pillTop,
      left,
      selectionBottom: rect.bottom + window.scrollY,
    }
  }, [])

  // ── Selection listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, " ").trim()

      // Clear any pending intent timer
      if (intentTimer.current) {
        clearTimeout(intentTimer.current)
        intentTimer.current = null
      }

      if (text.length > 10) {
        // Don't immediately show — wait to confirm the user actually wants AI
        intentTimer.current = setTimeout(() => {
          const pos = calcPosition()
          if (!pos) return
          setSelectedText(text)
          setPosition(pos)
          setPreview(null)
          setPreviewAction(null)
          setTranslateOpen(false)
          // Only advance to "pill" if currently hidden or still in pill state
          setPhase(prev => (prev === "hidden" || prev === "pill") ? "pill" : prev)
        }, INTENT_DELAY_MS)
      } else {
        // Selection collapsed or too short — hide everything except an active
        // loading or preview state, which the user must explicitly dismiss
        setPhase(prev => (prev === "hidden" || prev === "pill") ? "hidden" : prev)
        setTranslateOpen(false)
      }
    }

    editor.on("selectionUpdate", handleSelectionUpdate)
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
      if (intentTimer.current) clearTimeout(intentTimer.current)
    }
  }, [editor, calcPosition])

  // ── Click-outside to dismiss ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      if (pillRef.current && pillRef.current.contains(e.target as Node)) return

      const sel = window.getSelection()
      const selGone = !sel || sel.isCollapsed

      if (phase === "pill") {
        if (selGone) setPhase("hidden")
      } else if (phase === "menu") {
        // Clicking outside menu while selection still active → back to pill
        if (selGone) setPhase("hidden")
        else setPhase("pill")
        setTranslateOpen(false)
      } else if (phase === "preview") {
        // Clicking outside preview dismisses it fully
        setPhase("hidden")
        setPreview(null)
        setPreviewAction(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [phase])

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phase === "menu") { setPhase("pill"); setTranslateOpen(false) }
        else if (phase === "preview") { setPhase("menu"); setPreview(null) }
        else if (phase === "pill") setPhase("hidden")
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [phase])

  // ── Run an AI action ──────────────────────────────────────────────────────
  async function runAction(action: InlineRewriteAction) {
    if (!selectedText || loading) return
    setLoading(action)
    setPhase("preview")
    setPreview(null)
    setTranslateOpen(false)

    try {
      const result = await aiApi.inlineRewrite(selectedText, action)
      setPreview(result)
      setPreviewAction(action)
    } catch (err) {
      console.error("Inline AI error:", err)
      setPreview(t("errorRetry"))
      setPreviewAction(action)
    } finally {
      setLoading(null)
    }
  }

  function handleActionClick(id: ActionId) {
    if (id === "translate") {
      setTranslateOpen(prev => !prev)
    } else {
      runAction(id as InlineRewriteAction)
    }
  }

  // ── Apply the preview to the editor ──────────────────────────────────────
  function applyPreview() {
    if (!preview || !editor) return
    const { from, to } = editor.state.selection
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, preview).run()
    setPhase("hidden")
    setPreview(null)
    setPreviewAction(null)
    setSelectedText("")
  }

  function discardPreview() {
    setPreview(null)
    setPreviewAction(null)
    setPhase("menu")
  }

  function dismiss() {
    setPhase("hidden")
    setPreview(null)
    setPreviewAction(null)
    setTranslateOpen(false)
  }

  // ── Label helper ──────────────────────────────────────────────────────────
  function actionLabel(id: InlineRewriteAction): string {
    const mainAction = ACTIONS.find(a => a.id === id)
    if (mainAction) return mainAction.label
    const translateOpt = TRANSLATE_OPTIONS.find(opt => opt.id === id)
    if (translateOpt) return `${t("translate")} → ${translateOpt.label}`
    return id
  }

  // ── Menu top: place below selection always, shift up if needed ────────────
  function menuStyle(): React.CSSProperties {
    const MENU_HEIGHT_APPROX = 180
    const spaceBelow = window.innerHeight - (position.selectionBottom - window.scrollY)
    const top = spaceBelow > MENU_HEIGHT_APPROX
      ? position.top            // enough room below
      : position.selectionBottom - window.scrollY - MENU_HEIGHT_APPROX - 60  // flip above

    return { top, left: position.left }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === "hidden") return null

  // ── Pill: tiny non-blocking trigger ───────────────────────────────────────
  if (phase === "pill") {
    return (
      <button
        ref={pillRef}
        style={{ top: position.top, left: position.left + 10 }}
        className="fixed z-50 flex items-center gap-1.5 rounded-full border border-primary/30 bg-background px-2.5 py-1 text-xs font-medium text-primary shadow-md shadow-black/10 transition-all hover:bg-primary/10 hover:border-primary/60 hover:shadow-lg"
        onMouseDown={e => {
          e.preventDefault()
          e.stopPropagation()
          setPhase("menu")
        }}
      >
        <Sparkles className="h-3 w-3" />
        {t("trigger")}
      </button>
    )
  }

  // ── Menu or Preview ────────────────────────────────────────────────────────
  return (
    <div
      ref={menuRef}
      style={{ ...menuStyle(), width: 300 }}
      className="fixed z-50 rounded-xl border border-border bg-background shadow-xl shadow-black/10 ring-1 ring-black/5 dark:ring-white/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{t("menuTitle")}</span>
          {loading && (
            <span className="text-[10px] text-muted-foreground animate-pulse">{t("generating")}</span>
          )}
        </div>
        <button
          onClick={dismiss}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* ── Action buttons (menu phase) ─────────────────────────────────── */}
      {phase === "menu" && (
        <div className="p-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            const isTranslate = action.id === "translate"
            return (
              <div key={action.id} className="relative">
                <button
                  onClick={() => handleActionClick(action.id)}
                  disabled={!!loading}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all text-left",
                    "hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
                    isTranslate && translateOpen && "bg-accent",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", action.color)} />
                  <span className="flex-1 text-foreground">{action.label}</span>
                  {isTranslate && (
                    <ChevronRight className={cn(
                      "h-3 w-3 text-muted-foreground transition-transform duration-150",
                      translateOpen && "rotate-90",
                    )} />
                  )}
                </button>

                {/* Translate sub-options — inline dropdown */}
                {isTranslate && translateOpen && (
                  <div className="mt-0.5 ml-7 mb-1 flex flex-col gap-0.5">
                    {TRANSLATE_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => runAction(opt.id)}
                        disabled={!!loading}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-foreground transition-all hover:bg-accent disabled:opacity-50"
                      >
                        <span className="text-sm">{opt.flag}</span>
                        {opt.label}
                        {loading === opt.id && (
                          <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Preview (loading or result) ─────────────────────────────────── */}
      {phase === "preview" && (
        <div className="p-3">
          {/* Action badge */}
          {previewAction && (
            <div className="mb-2 flex items-center gap-1.5">
              <Languages className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {actionLabel(previewAction)}
              </span>
            </div>
          )}

          {/* Result text or spinner */}
          <div className="mb-3 min-h-[40px] max-h-36 overflow-y-auto rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-foreground">
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t("generatingResult")}</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{preview}</p>
            )}
          </div>

          {/* Apply / Discard — only shown when we have a result */}
          {!loading && preview && (
            <div className="flex gap-2">
              <button
                onClick={applyPreview}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Check className="h-3 w-3" />
                {t("apply")}
              </button>
              <button
                onClick={discardPreview}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
                {t("cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}