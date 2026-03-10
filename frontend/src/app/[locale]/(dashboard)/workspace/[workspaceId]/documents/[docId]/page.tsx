// src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/page.tsx

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
import { workspaceApi } from "@/lib/workspace.api";
import { useAuthStore } from "@/store/auth.store";
import { commentsApi } from "@/lib/comments.api";
import { Document, Workspace } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star,
  History,
  Loader2,
  ChevronLeft,
  Save,
  Pencil,
  Eye,
  Sparkles,
  MessageSquare,
  Download,
  FileText,
  FileDown,
  FileSpreadsheet,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { EditorToolbar } from "./_components/EditorToolbar";
import { VersionHistory } from "./_components/VersionHistory";
import { AiChatPanel } from "./_components/AiChatPanel";
import { CommentsPanel } from "./_components/CommentsPanel";
import { ShareModal } from "./_components/ShareModal";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DocumentEditorPage() {
  const params = useParams();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string;
  const docId = params.docId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("dashboard.editor");

  // Current user (needed by CommentsPanel to know who is editing)
  const { user } = useAuthStore();

  // ── Export state ───────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState<
    "pdf" | "docx" | "excel" | null
  >(null);

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);

  // ── Panel state — only one panel open at a time ────────────────────────────
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [isFavori, setIsFavori] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const currentContentRef = useRef<any>(null);
  const isLoadedRef = useRef(false);
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSyncTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: doc, isLoading } = useQuery<Document>({
    queryKey: ["document", docId],
    queryFn: () => documentApi.getOne(docId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  // Count of unresolved comments — shown as badge on the Comments button
  const { data: allComments = [] } = useQuery({
    queryKey: ["comments", docId],
    queryFn: () => commentsApi.getAll(docId),
    staleTime: 30000,
  });
  const openCommentsCount = allComments.filter((c) => !c.estResolu).length;

  const canEdit = workspace
    ? ["EDITEUR", "ADMINISTRATEUR", "PROPRIETAIRE"].includes(workspace.monRole)
    : false;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const silentSyncMutation = useMutation({
    mutationFn: (contenu: any) => documentApi.updateSilent(docId, { contenu }),
  });

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

  // ── TipTap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
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
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "border-collapse table-auto w-full" },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: t("placeholder") }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      currentContentRef.current = editor.getJSON();
      if (isLoadedRef.current) setHasUnsavedChanges(true);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) setTimeout(() => editor.commands.focus("end"), 50);
  }, [isEditing, editor]);

  useEffect(() => {
    if (doc && editor && !isLoadedRef.current) {
      setTitle(doc.titre);
      setIsFavori(doc.estFavori);
      setLastSaved(new Date(doc.dateMiseAJour));
      if (doc.contenu && Object.keys(doc.contenu).length > 0) {
        editor.commands.setContent(doc.contenu);
        currentContentRef.current = doc.contenu;
      }
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 200);
    }
  }, [doc, editor]);

  useEffect(() => {
    if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    autoSyncTimer.current = setInterval(() => {
      if (currentContentRef.current && hasUnsavedChanges && isEditing) {
        silentSyncMutation.mutate(currentContentRef.current);
      }
    }, 10000);
    return () => {
      if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    };
  }, [hasUnsavedChanges, isEditing]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleManualSave = useCallback(() => {
    if (!editor || !currentContentRef.current || !isEditing) return;
    saveMutation.mutate({ titre: title, contenu: currentContentRef.current });
  }, [editor, title, isEditing, saveMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleManualSave]);

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

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
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
    }
  }

  function handleExitEdit() {
    if (hasUnsavedChanges && currentContentRef.current) {
      saveMutation.mutate({ titre: title, contenu: currentContentRef.current });
    }
    setIsEditing(false);
  }

  function handleBack() {
    if (hasUnsavedChanges) {
      const ok = confirm(t("unsavedWarning"));
      if (!ok) return;
    }
    router.push(`/${locale}/workspace/${workspaceId}/documents`);
  }

  async function handleExport(format: "pdf" | "docx" | "excel") {
    setIsExporting(format);
    try {
      if (format === "pdf") await documentApi.exportPdf(docId, title);
      if (format === "docx") await documentApi.exportDocx(docId, title);
      if (format === "excel") await documentApi.exportExcel(docId, title);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(null);
    }
  }

  // Only one panel open at a time
  function toggleAiPanel() {
    setAiPanelOpen((v) => {
      if (!v) setCommentsPanelOpen(false);
      return !v;
    });
  }

  function toggleCommentsPanel() {
    setCommentsPanelOpen((v) => {
      if (!v) setAiPanelOpen(false);
      return !v;
    });
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isLoading || !editor) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const anyPanelOpen = aiPanelOpen || commentsPanelOpen;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex h-full flex-col transition-all duration-300",
          anyPanelOpen ? "mr-[420px]" : "mr-0",
        )}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleBack}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{t("back")}</span>
            </Button>

            {isEditing ? (
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("untitled")}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground truncate"
              />
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground select-text">
                {title || t("untitled")}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Save status */}
            {isEditing && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {hasUnsavedChanges ? (
                  <span className="text-yellow-500 font-medium">
                    {t("unsaved")}
                  </span>
                ) : lastSaved ? (
                  t("saved", {
                    time: formatDistanceToNow(lastSaved, { addSuffix: true }),
                  })
                ) : null}
              </span>
            )}

            {/* Share */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("share")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("share")}</TooltipContent>
            </Tooltip>

            {/* ── Comments button with unresolved count badge ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCommentsPanel}
                  className={cn(
                    "relative flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                    commentsPanelOpen
                      ? "bg-orange-500 text-white"
                      : "border border-orange-400/30 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("comments")}</span>
                  {openCommentsCount > 0 && (
                    <span
                      className={cn(
                        "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        commentsPanelOpen
                          ? "bg-white text-orange-500"
                          : "bg-orange-500 text-white",
                      )}
                    >
                      {openCommentsCount > 99 ? "99+" : openCommentsCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {commentsPanelOpen ? t("closeComments") : t("openComments")}
              </TooltipContent>
            </Tooltip>

            {/* AI Assistant */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleAiPanel}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                    aiPanelOpen
                      ? "bg-primary text-primary-foreground"
                      : "border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("askAi")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {aiPanelOpen ? t("closeAi") : t("openAi")}
              </TooltipContent>
            </Tooltip>

            {/* Export */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      disabled={!!isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("export")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport("pdf")}
                  disabled={!!isExporting}
                >
                  <FileText className="h-3.5 w-3.5 text-red-500" />
                  {t("exportPdf")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport("docx")}
                  disabled={!!isExporting}
                >
                  <FileDown className="h-3.5 w-3.5 text-blue-500" />
                  {t("exportDocx")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport("excel")}
                  disabled={!!isExporting}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  {t("exportExcel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Star */}
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

            {/* Edit / Save / Done */}
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
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
                <Button size="sm" className="gap-1.5" onClick={handleExitEdit}>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("doneEditing")}</span>
                </Button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={canEdit ? -1 : 0}>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!canEdit}
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t("edit")}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canEdit && <TooltipContent>{t("readOnly")}</TooltipContent>}
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        {isEditing && (
          <EditorToolbar editor={editor} onImageUpload={handleImageUpload} />
        )}

        {/* ── Content area ────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent">
          <div className="mx-auto max-w-3xl px-8 py-10">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* ── Version history ──────────────────────────────────────────────── */}
        <VersionHistory
          docId={docId}
          workspaceId={workspaceId}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          editor={editor}
          onRestored={() => {
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
          }}
        />
      </div>

      {/* ── AI Chat Panel ────────────────────────────────────────────────── */}
      <AiChatPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        workspaceId={workspaceId}
        docId={docId}
        docTitle={title}
        mode="document"
      />

      {/* ── Comments Panel ───────────────────────────────────────────────── */}
      <CommentsPanel
        open={commentsPanelOpen}
        onClose={() => setCommentsPanelOpen(false)}
        documentId={docId}
        currentUserId={user?.id ?? ""}
        currentUserRole={workspace?.monRole ?? "LECTEUR"}
      />

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        documentId={docId}
        documentTitle={title}
      />
    </TooltipProvider>
  );
}
