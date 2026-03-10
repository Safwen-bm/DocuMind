// src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/_components/CommentsPanel.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { commentsApi, Comment } from "@/lib/comments.api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr, ar, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  Check,
  XCircle,
} from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────────

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  currentUserId: string;
  currentUserRole: string;
}

// ── Helper: get date-fns locale ────────────────────────────────────────────────

function getDateLocale(locale: string) {
  if (locale === "fr") return fr;
  if (locale === "ar") return ar;
  return enUS;
}

// ── Avatar placeholder ─────────────────────────────────────────────────────────

function Avatar({
  nom,
  avatarUrl,
  size = "sm",
}: {
  nom: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nom}
        className={cn("rounded-full object-cover shrink-0", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0",
        dim,
      )}
    >
      {nom.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Single comment card ────────────────────────────────────────────────────────

function CommentCard({
  comment,
  currentUserId,
  canDelete,
  documentId,
  onUpdated,
  onDeleted,
}: {
  comment: Comment;
  currentUserId: string;
  canDelete: boolean; // true if admin/owner
  documentId: string;
  onUpdated: (c: Comment) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("dashboard.comments");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.contenu);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAuthor = comment.auteurId === currentUserId;

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isEditing]);

  async function handleEdit() {
    if (!editValue.trim() || editValue === comment.contenu) {
      setIsEditing(false);
      return;
    }
    setEditLoading(true);
    try {
      const updated = await commentsApi.update(
        documentId,
        comment.id,
        editValue.trim(),
      );
      onUpdated(updated);
      setIsEditing(false);
    } catch {
      // silently fail — user stays in edit mode
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await commentsApi.remove(documentId, comment.id);
      onDeleted(comment.id);
    } catch {
      setDeleteLoading(false);
    }
  }

  async function handleToggleResolu() {
    setResolveLoading(true);
    try {
      const updated = await commentsApi.toggleResolu(documentId, comment.id);
      onUpdated(updated);
    } catch {
      // silently fail
    } finally {
      setResolveLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card p-3.5 transition-all",
        comment.estResolu && "opacity-60",
      )}
    >
      {/* Header: avatar + name + date + actions */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            nom={comment.auteur.nom}
            avatarUrl={comment.auteur.avatarUrl}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-none">
              {comment.auteur.nom}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(comment.dateCreation), {
                addSuffix: true,
                locale: dateLocale,
              })}
            </p>
          </div>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Resolve toggle */}
          <button
            onClick={handleToggleResolu}
            disabled={resolveLoading}
            title={comment.estResolu ? t("unresolve") : t("resolve")}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              comment.estResolu
                ? "text-green-500 hover:bg-green-500/10"
                : "text-muted-foreground hover:bg-accent hover:text-green-500",
            )}
          >
            {resolveLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : comment.estResolu ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Edit — only author */}
          {isAuthor && !comment.estResolu && (
            <button
              onClick={() => {
                setEditValue(comment.contenu);
                setIsEditing(true);
              }}
              title={t("edit")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}

          {/* Delete — author or admin */}
          {(isAuthor || canDelete) && (
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              title={t("delete")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              {deleteLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Resolved badge */}
      {comment.estResolu && (
        <div className="flex items-center gap-1 mb-2">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span className="text-[10px] font-medium text-green-500">
            {t("resolved")}
          </span>
        </div>
      )}

      {/* Content — normal view or edit mode */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEdit();
              }
              if (e.key === "Escape") {
                setIsEditing(false);
                setEditValue(comment.contenu);
              }
            }}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditValue(comment.contenu);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleEdit}
              disabled={editLoading || !editValue.trim()}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {editLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {comment.contenu}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CommentsPanel({
  open,
  onClose,
  documentId,
  currentUserId,
  currentUserRole,
}: CommentsPanelProps) {
  const t = useTranslations("dashboard.comments");
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canAdminDelete = ["ADMINISTRATEUR", "PROPRIETAIRE"].includes(
    currentUserRole,
  );

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── Fetch comments ─────────────────────────────────────────────────────────
  const {
    data: comments = [],
    isLoading,
  } = useQuery<Comment[]>({
    queryKey: ["comments", documentId],
    queryFn: () => commentsApi.getAll(documentId),
    enabled: open, // only fetch when panel is open
    refetchInterval: open ? 15000 : false, // poll every 15s while open
  });

  // ── Post comment ───────────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: (contenu: string) => commentsApi.create(documentId, contenu),
    onSuccess: (newComment) => {
      // Optimistically add to cache
      queryClient.setQueryData<Comment[]>(
        ["comments", documentId],
        (old = []) => [...old, newComment],
      );
      setInput("");
      // Scroll to bottom after render
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
  });

  function handlePost() {
    const text = input.trim();
    if (!text || postMutation.isPending) return;
    postMutation.mutate(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  }

  // ── Local update handlers (no refetch needed) ──────────────────────────────
  function handleUpdated(updated: Comment) {
    queryClient.setQueryData<Comment[]>(
      ["comments", documentId],
      (old = []) => old.map((c) => (c.id === updated.id ? updated : c)),
    );
  }

  function handleDeleted(id: string) {
    queryClient.setQueryData<Comment[]>(
      ["comments", documentId],
      (old = []) => old.filter((c) => c.id !== id),
    );
  }

  // ── Filter comments ────────────────────────────────────────────────────────
  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.estResolu;
    if (filter === "resolved") return c.estResolu;
    return true;
  });

  const openCount = comments.filter((c) => !c.estResolu).length;
  const resolvedCount = comments.filter((c) => c.estResolu).length;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-[420px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
              <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">
                {t("title")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {openCount} {t("open")} · {resolvedCount} {t("resolvedCount")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t(f)}
            </button>
          ))}
        </div>

        {/* ── Comments list ────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-4">
                <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {filter === "all"
                  ? t("emptyAll")
                  : filter === "open"
                    ? t("emptyOpen")
                    : t("emptyResolved")}
              </p>
              {filter === "all" && (
                <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px]">
                  {t("emptyAllDesc")}
                </p>
              )}
            </div>
          )}

          {/* Comment cards */}
          {!isLoading &&
            filtered.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                canDelete={canAdminDelete}
                documentId={documentId}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ───────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 focus-within:border-primary/50 focus-within:bg-background transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inputPlaceholder")}
              rows={1}
              disabled={postMutation.isPending}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 max-h-28 [&::-webkit-scrollbar]:hidden"
              style={{ fieldSizing: "content" } as any}
            />
            <button
              onClick={handlePost}
              disabled={!input.trim() || postMutation.isPending}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {postMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            {t("hint")}
          </p>
        </div>
      </div>
    </>
  );
}