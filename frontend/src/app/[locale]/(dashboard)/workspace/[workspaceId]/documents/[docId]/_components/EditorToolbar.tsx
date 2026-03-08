// src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/_components/EditorToolbar.tsx

"use client"

import { useRef, useState } from "react"
import { Editor } from "@tiptap/react"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Highlighter,
  Undo, Redo, Minus, Quote, Palette, ImageIcon, Loader2,
  Table, Trash2, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

// ── Colors ────────────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Default",  value: "" },
  { label: "Red",      value: "#ef4444" },
  { label: "Orange",   value: "#f97316" },
  { label: "Amber",    value: "#f59e0b" },
  { label: "Green",    value: "#22c55e" },
  { label: "Teal",     value: "#14b8a6" },
  { label: "Blue",     value: "#3b82f6" },
  { label: "Indigo",   value: "#6366f1" },
  { label: "Purple",   value: "#a855f7" },
  { label: "Pink",     value: "#ec4899" },
  { label: "Gray",     value: "#6b7280" },
  { label: "Black",    value: "#000000" },
]

const HIGHLIGHT_COLORS = [
  { label: "None",   value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green",  value: "#bbf7d0" },
  { label: "Blue",   value: "#bfdbfe" },
  { label: "Pink",   value: "#fbcfe8" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Red",    value: "#fecaca" },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active = false, disabled = false, tooltip, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onMouseDown={e => { e.preventDefault(); onClick() }}
          disabled={disabled}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
            active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
            disabled && "opacity-40 cursor-not-allowed",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />
}

function ColorPicker({
  colors, value, onChange, tooltip, icon: Icon,
}: {
  colors: { label: string; value: string }[]
  value: string
  onChange: (val: string) => void
  tooltip: string
  icon: React.ElementType
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              onMouseDown={e => e.preventDefault()}
              className="flex h-8 w-8 flex-col items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground relative"
            >
              <Icon className="h-3.5 w-3.5" />
              <div
                className="absolute bottom-1 left-1.5 right-1.5 h-[3px] rounded-full"
                style={{
                  backgroundColor: value || "transparent",
                  border: value ? "none" : "1px dashed #ccc",
                }}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" className="w-48 p-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">{tooltip}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map(c => (
            <Tooltip key={c.value}>
              <TooltipTrigger asChild>
                <button
                  onMouseDown={e => { e.preventDefault(); onChange(c.value) }}
                  className={cn(
                    "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110",
                    value === c.value ? "border-primary ring-1 ring-primary" : "border-transparent",
                  )}
                  style={{
                    backgroundColor: c.value || "transparent",
                    border: !c.value ? "2px dashed #ccc" : undefined,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs">{c.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Table dropdown ────────────────────────────────────────────────────────────

function TableMenu({ editor }: { editor: Editor }) {
  const t = useTranslations("dashboard.editor")
  const isInTable = editor.isActive("table")

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              onMouseDown={e => e.preventDefault()}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                isInTable
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Table className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t("table.label")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-52">
        {!isInTable ? (
          // Not in a table — show insert option
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onMouseDown={e => {
              e.preventDefault()
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("table.insert")}
          </DropdownMenuItem>
        ) : (
          // Inside a table — show all table controls
          <>
            <DropdownMenuItem className="gap-2 cursor-pointer text-xs font-semibold text-muted-foreground" disabled>
              {t("table.columns")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnBefore().run() }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("table.addColBefore")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("table.addColAfter")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteColumn().run() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("table.deleteCol")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 cursor-pointer text-xs font-semibold text-muted-foreground" disabled>
              {t("table.rows")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowBefore().run() }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("table.addRowBefore")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("table.addRowAfter")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteRow().run() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("table.deleteRow")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteTable().run() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("table.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  editor: Editor
  onImageUpload: (file: File) => Promise<void>
}

export function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
  const t = useTranslations("dashboard.editor")
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [imageUploading, setImageUploading] = useState(false)

  const currentTextColor = editor.getAttributes("textStyle")?.color ?? ""
  const currentHighlight = editor.getAttributes("highlight")?.color ?? ""

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    try {
      await onImageUpload(file)
    } finally {
      setImageUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-background px-4 py-2">

      {/* Undo / Redo */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} tooltip="Undo (Ctrl+Z)">
        <Undo className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} tooltip="Redo (Ctrl+Y)">
        <Redo className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} tooltip="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} tooltip="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} tooltip="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Inline formatting */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} tooltip="Bold (Ctrl+B)">
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} tooltip="Italic (Ctrl+I)">
        <Italic className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} tooltip="Underline (Ctrl+U)">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} tooltip="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Colors */}
      <ColorPicker
        colors={TEXT_COLORS}
        value={currentTextColor}
        onChange={val => val
          ? editor.chain().focus().setColor(val).run()
          : editor.chain().focus().unsetColor().run()
        }
        tooltip={t("textColor")}
        icon={Palette}
      />
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        value={currentHighlight}
        onChange={val => val
          ? editor.chain().focus().toggleHighlight({ color: val }).run()
          : editor.chain().focus().unsetHighlight().run()
        }
        tooltip={t("highlightColor")}
        icon={Highlighter}
      />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} tooltip="Inline code">
        <Code className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Alignment */}
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} tooltip="Align left">
        <AlignLeft className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} tooltip="Align center">
        <AlignCenter className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} tooltip="Align right">
        <AlignRight className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Lists & blocks */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} tooltip="Bullet list">
        <List className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} tooltip="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} tooltip="Blockquote">
        <Quote className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} tooltip="Code block">
        <Code className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} tooltip="Horizontal rule">
        <Minus className="h-4 w-4" />
      </ToolbarBtn>

      <Divider />

      {/* Table */}
      <TableMenu editor={editor} />

      <Divider />

      {/* Image */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onMouseDown={e => { e.preventDefault(); imageInputRef.current?.click() }}
            disabled={imageUploading}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              imageUploading && "opacity-50 cursor-not-allowed",
            )}
          >
            {imageUploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ImageIcon className="h-4 w-4" />
            }
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t("insertImage")}</TooltipContent>
      </Tooltip>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}