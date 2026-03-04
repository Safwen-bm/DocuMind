"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { documentApi } from "@/lib/document.api";
import { Document, VersionDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo,
  Redo,
  Star,
  History,
  Loader2,
  ChevronLeft,
  RotateCcw,
  Minus,
  Quote,
  Palette,
  Save,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useTranslations } from "next-intl";

// ─── Colors ──────────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Gray", value: "#6b7280" },
  { label: "Black", value: "#000000" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Orange", value: "#fed7aa" },
  { label: "Red", value: "#fecaca" },
];

// ─── Toolbar Button ───────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            onClick();
          }}
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
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function ColorPicker({
  colors,
  value,
  onChange,
  tooltip,
  icon: Icon,
}: {
  colors: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
  tooltip: string;
  icon: React.ElementType;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              onMouseDown={(e) => e.preventDefault()}
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
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" className="w-48 p-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          {tooltip}
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map((c) => (
            <Tooltip key={c.value}>
              <TooltipTrigger asChild>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(c.value);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110",
                    value === c.value
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent",
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
  );
}

// ─── Main Editor Page ─────────────────────────────────────────────────────────
export default function DocumentEditorPage() {
  const params = useParams();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string;
  const docId = params.docId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<VersionDocument | null>(
    null,
  );
  const [isFavori, setIsFavori] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSyncTimer = useRef<NodeJS.Timeout | null>(null);

  const t = useTranslations("dashboard.editor");

  // Track current content for auto-sync (no version)
  const currentContentRef = useRef<any>(null);
  const isLoadedRef = useRef(false);

  const { data: doc, isLoading } = useQuery<Document>({
    queryKey: ["document", docId],
    queryFn: () => documentApi.getOne(docId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: versions } = useQuery<VersionDocument[]>({
    queryKey: ["versions", docId],
    queryFn: () => documentApi.getVersions(docId),
    enabled: historyOpen,
  });

  // Silent auto-sync — updates content in DB but does NOT create a version
  const silentSyncMutation = useMutation({
    mutationFn: (contenu: any) => documentApi.updateSilent(docId, { contenu }),
  });

  // Manual save — creates a version
  const saveMutation = useMutation({
    mutationFn: (data: {
      titre?: string;
      contenu?: any;
      estFavori?: boolean;
    }) => documentApi.update(docId, data),
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] });
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] });
      queryClient.invalidateQueries({ queryKey: ["versions", docId] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) =>
      documentApi.restoreVersion(docId, versionId),
    onSuccess: (restored) => {
      editor?.commands.setContent(
        restored.contenu || { type: "doc", content: [] },
      );
      currentContentRef.current = restored.contenu;
      queryClient.invalidateQueries({ queryKey: ["versions", docId] });
      setRestoreVersion(null);
      setHistoryOpen(false);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    },
  });

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-sync every 10s silently (no version, no notification)
  const startAutoSync = useCallback(() => {
    if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    autoSyncTimer.current = setInterval(() => {
      if (currentContentRef.current && hasUnsavedChanges) {
        silentSyncMutation.mutate(currentContentRef.current);
      }
    }, 10000);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    startAutoSync();
    return () => {
      if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    };
  }, [startAutoSync]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-lg bg-muted p-4 font-mono text-sm",
          },
        },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full my-4" },
      }),
      Placeholder.configure({ placeholder : t("placeholder")}),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      currentContentRef.current = editor.getJSON();
      if (isLoadedRef.current) {
        setHasUnsavedChanges(true);
      }
    },
  });

  // Manual save handler — Ctrl+S support
  const handleManualSave = useCallback(() => {
    if (!editor || !currentContentRef.current) return;
    saveMutation.mutate({
      titre: title,
      contenu: currentContentRef.current,
    });
  }, [editor, title, saveMutation]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleManualSave]);

  // Load document
  useEffect(() => {
    if (doc && editor && !isLoadedRef.current) {
      setTitle(doc.titre);
      setIsFavori(doc.estFavori);
      setLastSaved(new Date(doc.dateMiseAJour));
      if (doc.contenu && Object.keys(doc.contenu).length > 0) {
        editor.commands.setContent(doc.contenu);
        currentContentRef.current = doc.contenu;
      }
      // Small delay to avoid marking initial load as unsaved
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 200);
    }
  }, [doc, editor]);

  // Title auto-save (title changes still save immediately, no version)
  function handleTitleChange(value: string) {
    setTitle(value);
    setHasUnsavedChanges(true);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      silentSyncMutation.mutate({ titre: value } as any);
    }, 1500);
  }

  function handleToggleFavori() {
    const newVal = !isFavori;
    setIsFavori(newVal);
    saveMutation.mutate({ estFavori: newVal });
  }

  // Image upload to Cloudinary
  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "documind");
      formData.append("folder", "documents");
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (data.secure_url) {
        editor?.chain().focus().setImage({ src: data.secure_url }).run();
        setHasUnsavedChanges(true);
      }
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setImageUploading(false);
    }
  }

  const currentTextColor = editor?.getAttributes("textStyle")?.color ?? "";
  const currentHighlight = editor?.getAttributes("highlight")?.color ?? "";

  if (isLoading || !editor) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                if (hasUnsavedChanges) {
                  const ok = confirm(t("unsavedWarning"));
                  if (!ok) return;
                }
                router.push(`/${locale}/workspace/${workspaceId}/documents`);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{t("back")}</span>
            </Button>

            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t("untitled")}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground truncate"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Save status */}
            <span className="text-xs text-muted-foreground hidden sm:block">
              {hasUnsavedChanges ? (
                <span className="text-yellow-500 font-medium">
                  {t("unsaved")}
                </span>
              ) : lastSaved ? (
                `${t("saved", { time: formatDistanceToNow(lastSaved, { addSuffix: true }) })}`
              ) : null}
            </span>

            {/* Favori */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleFavori}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent",
                    isFavori ? "text-yellow-500" : "text-muted-foreground",
                  )}
                >
                  <Star
                    className={cn("h-4 w-4", isFavori && "fill-yellow-500")}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavori ? t("removeFromStarred") : t("addToStarred")}
              </TooltipContent>
            </Tooltip>

            {/* Version history */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <History className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("versionHistory")}</TooltipContent>
            </Tooltip>

            {/* Save button */}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleManualSave}
              disabled={saveMutation.isPending || !hasUnsavedChanges}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {saveMutation.isPending ? t("saving") : t("save")}
              </span>
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-background px-4 py-2">
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            tooltip="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            tooltip="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            tooltip="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            tooltip="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            tooltip="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            tooltip="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            tooltip="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            tooltip="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            tooltip="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          <ColorPicker
            colors={TEXT_COLORS}
            value={currentTextColor}
            onChange={(val) =>
              val
                ? editor.chain().focus().setColor(val).run()
                : editor.chain().focus().unsetColor().run()
            }
            tooltip={t("textColor")}
            icon={Palette}
          />
          <ColorPicker
            colors={HIGHLIGHT_COLORS}
            value={currentHighlight}
            onChange={(val) =>
              val
                ? editor.chain().focus().toggleHighlight({ color: val }).run()
                : editor.chain().focus().unsetHighlight().run()
            }
            tooltip={t("highlightColor")}
            icon={Highlighter}
          />
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            tooltip="Inline code"
          >
            <Code className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            tooltip="Align left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            tooltip="Align center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            tooltip="Align right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            tooltip="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            tooltip="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            tooltip="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            tooltip="Code block"
          >
            <Code className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            tooltip="Horizontal rule"
          >
            <Minus className="h-4 w-4" />
          </ToolbarBtn>

          <Divider />

          {/* Image upload button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  imageInputRef.current?.click();
                }}
                disabled={imageUploading}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  imageUploading && "opacity-50 cursor-not-allowed",
                )}
              >
                {imageUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("insertImage")}
            </TooltipContent>
          </Tooltip>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-10">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Version History Sheet */}
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="right" className="w-80 p-0">
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-primary" />
                {t("versionHistoryPanel.title")}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-full pb-20">
              {!versions ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <History className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">
                    {t("versionHistoryPanel.noVersions")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("versionHistoryPanel.noVersionsDesc")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        {v.createdBy.avatarUrl && (
                          <AvatarImage src={v.createdBy.avatarUrl} />
                        )}
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                          {v.createdBy.nom[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">
                          Version {v.numero}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.createdBy.nom}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(
                            new Date(v.dateCreation),
                            "MMM d, yyyy · HH:mm",
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(v.dateCreation), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => setRestoreVersion(v)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Restore confirmation */}
        <Dialog
          open={!!restoreVersion}
          onOpenChange={() => setRestoreVersion(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("restoreModal.title")}</DialogTitle>
              <DialogDescription>
                Version {restoreVersion?.numero} {t("restoreModal.desc")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-2">
              <Button variant="outline" onClick={() => setRestoreVersion(null)}>
                {t("restoreModal.cancel")}
              </Button>
              <Button
                onClick={() =>
                  restoreVersion && restoreMutation.mutate(restoreVersion.id)
                }
                disabled={restoreMutation.isPending}
              >
                {t("restoreModal.submit")}
                {restoreMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
