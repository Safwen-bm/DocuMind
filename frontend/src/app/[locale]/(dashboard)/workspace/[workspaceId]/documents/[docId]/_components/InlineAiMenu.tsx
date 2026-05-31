"use client"

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\[docId]\_components\InlineAiMenu.tsx

import { useState, useEffect, useRef, useCallback } from "react"
import { Editor } from "@tiptap/react"
import { Wand2, Sparkles, Languages, RefreshCw, Loader2, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { aiApi } from "@/lib/ai.api"

interface InlineAiMenuProps {
  editor: Editor
  workspaceId: string
}

type AiAction = "improve" | "simplify" | "translate" | "rephrase"

interface MenuPosition {
  top: number
  left: number
}

const ACTIONS: { id: AiAction; label: string; labelFr: string; icon: React.ElementType; color: string }[] = [
  { id: "improve",   label: "Improve",   labelFr: "Améliorer",   icon: Sparkles,   color: "text-blue-500" },
  { id: "simplify",  label: "Simplify",  labelFr: "Simplifier",  icon: Wand2,      color: "text-violet-500" },
  { id: "rephrase",  label: "Rephrase",  labelFr: "Reformuler",  icon: RefreshCw,  color: "text-emerald-500" },
  { id: "translate", label: "Translate", labelFr: "Traduire EN", icon: Languages,  color: "text-amber-500" },
]

export function InlineAiMenu({ editor, workspaceId }: InlineAiMenuProps) {
  const [visible, setVisible]       = useState(false)
  const [position, setPosition]     = useState<MenuPosition>({ top: 0, left: 0 })
  const [loading, setLoading]       = useState<AiAction | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [previewAction, setPreviewAction] = useState<AiAction | null>(null)
  const [selectedText, setSelectedText]   = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  // Calculate floating menu position from current selection
  const updatePosition = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    if (!rect.width) return

    // Position above the selection, centered
    const menuWidth = 280
    let left = rect.left + rect.width / 2 - menuWidth / 2
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))

    setPosition({
      top:  rect.top + window.scrollY - 56,
      left: left,
    })
  }, [])

  // Listen to editor selection changes
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, " ").trim()

      if (text.length > 10) {
        setSelectedText(text)
        setPreview(null)
        setPreviewAction(null)
        updatePosition()
        setVisible(true)
      } else {
        setVisible(false)
        setPreview(null)
      }
    }

    editor.on("selectionUpdate", handleSelectionUpdate)
    return () => { editor.off("selectionUpdate", handleSelectionUpdate) }
  }, [editor, updatePosition])

  // Hide when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Only hide if selection is gone
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) {
          setVisible(false)
          setPreview(null)
        }
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleAction(action: AiAction) {
    if (!selectedText || loading) return
    setLoading(action)
    setPreview(null)

    try {
      const result = await aiApi.inlineRewrite(selectedText, action)
      setPreview(result)
      setPreviewAction(action)
    } catch (err) {
      console.error("Inline AI error:", err)
    } finally {
      setLoading(null)
    }
  }

  function applyPreview() {
    if (!preview || !editor) return

    // Replace the current selection with the AI result
    const { from, to } = editor.state.selection
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, preview).run()

    setVisible(false)
    setPreview(null)
    setPreviewAction(null)
    setSelectedText("")
  }

  function discardPreview() {
    setPreview(null)
    setPreviewAction(null)
  }

  if (!visible) return null

  return (
    <div
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-50 w-[280px] rounded-xl border border-border bg-background shadow-xl shadow-black/10 ring-1 ring-black/5 dark:ring-white/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">AI Actions</span>
        </div>
        <button
          onClick={() => { setVisible(false); setPreview(null) }}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Action buttons */}
      {!preview && (
        <div className="flex flex-wrap gap-1.5 p-2.5">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            const isLoading = loading === action.id
            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={!!loading}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-all",
                  "hover:bg-accent hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed",
                  isLoading && "bg-accent border-primary/30"
                )}
              >
                {isLoading
                  ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  : <Icon className={cn("h-3 w-3", action.color)} />
                }
                <span className={isLoading ? "text-primary" : "text-foreground"}>
                  {isLoading ? "..." : action.labelFr}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Preview result */}
      {preview && (
        <div className="p-3">
          {/* Action badge */}
          <div className="mb-2 flex items-center gap-1.5">
            {previewAction && (() => {
              const action = ACTIONS.find(a => a.id === previewAction)!
              const Icon = action.icon
              return (
                <>
                  <Icon className={cn("h-3 w-3", action.color)} />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {action.labelFr}
                  </span>
                </>
              )
            })()}
          </div>

          {/* Preview text */}
          <div className="mb-3 max-h-28 overflow-y-auto rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-foreground">
            {preview}
          </div>

          {/* Accept / Discard */}
          <div className="flex gap-2">
            <button
              onClick={applyPreview}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
              Appliquer
            </button>
            <button
              onClick={discardPreview}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}