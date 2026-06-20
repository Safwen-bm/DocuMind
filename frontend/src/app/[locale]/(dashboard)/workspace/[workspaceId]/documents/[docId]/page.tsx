// frontend/src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { documentApi } from '@/lib/document.api';
import { workspaceApi } from '@/lib/workspace.api';
import { useAuthStore } from '@/store/auth.store';
import { commentsApi } from '@/lib/comments.api';
import { Document, Workspace } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { EditorToolbar } from './_components/EditorToolbar';
import { VersionHistory } from './_components/VersionHistory';
import { AiChatPanel } from './_components/AiChatPanel';
import { CommentsPanel } from './_components/CommentsPanel';
import { ShareModal } from './_components/ShareModal';
import { InlineAiMenu } from './_components/InlineAiMenu';
import { PresenceAvatars } from './_components/PresenceAvatars';
import { LockBanner } from './_components/LockBanner';
import { useDocumentPresence } from '@/hooks/useDocumentPresence';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// ── Helper: auto-suffix "name" → "name (1)" → "name (2)" etc. ────────────────
function buildSuffixedTitle(titre: string): string {
  const base = titre.replace(/\s*\(\d+\)$/, '');
  // We can't query the DB here, so we just add (1); the backend resolveUniqueTitle
  // will bump it further if (1) also exists.
  return `${base} (1)`;
}

export default function DocumentEditorPage() {
  const params = useParams();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string;
  const docId = params.docId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('dashboard.editor');
  const { user } = useAuthStore();

  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | 'excel' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isFavori, setIsFavori] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [updatedBy, setUpdatedBy] = useState<{
    nom: string;
    avatarUrl: string | null;
    userId: string;
    isEditing: boolean;
  } | null>(null);

  // ── NEW: 409 conflict state ───────────────────────────────────────────────
  const [titleConflict, setTitleConflict] = useState<string | null>(null);

  const isSavingRef = useRef(false);
  const currentContentRef = useRef<any>(null);
  const isLoadedRef = useRef(false);
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSyncTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const {
    data: doc,
    isLoading,
    refetch: refetchDoc,
  } = useQuery<Document>({
    queryKey: ['document', docId],
    queryFn: () => documentApi.getOne(docId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ['comments', docId],
    queryFn: () => commentsApi.getAll(docId),
    staleTime: 30000,
  });
  const openCommentsCount = allComments.filter((c: any) => !c.estResolu).length;

  const canEdit = workspace
    ? ['EDITEUR', 'ADMINISTRATEUR', 'PROPRIETAIRE'].includes(workspace.monRole)
    : false;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const silentSyncMutation = useMutation({
    mutationFn: (contenu: any) => documentApi.updateSilent(docId, { contenu }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { titre?: string; contenu?: any }) =>
      documentApi.update(docId, data),
    onMutate: () => {
      isSavingRef.current = true;
      // Clear any previous conflict banner when retrying
      setTitleConflict(null);
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      isSavingRef.current = false;
      setLastSaved(new Date());
      emitSaved();
      queryClient.invalidateQueries({ queryKey: ['docs', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recent-docs'] });
      queryClient.invalidateQueries({ queryKey: ['favori-docs'] });
      queryClient.invalidateQueries({ queryKey: ['versions', docId] });
    },
    onError: (err: any) => {
      isSavingRef.current = false;
      const status = err?.response?.status ?? err?.status;
      if (status === 409) {
        // Show an inline conflict banner — do NOT crash, do NOT lose content
        setTitleConflict(title);
      } else {
        toast.error(t('saveError'));
      }
    },
  });

  // ── NEW: auto-suffix retry ────────────────────────────────────────────────
  function handleAutoRename() {
    const newTitle = buildSuffixedTitle(title);
    setTitle(newTitle);
    setTitleConflict(null);
    saveMutation.mutate({ titre: newTitle, contenu: currentContentRef.current });
  }

  // ── Presence ──────────────────────────────────────────────────────────────

  const { presence, emitSaved } = useDocumentPresence({
    documentId: docId,
    user: user ?? null,
    isEditing,
    onLockDenied: (lockedBy) => {
      setIsEditing(false);
      toast.error(`${lockedBy.nom} is currently editing this document.`, {
        description: 'Editing is locked. Please wait until they are done.',
        duration: 5000,
      });
    },
    onDocumentUpdated: () => {
      if (!isEditing) {
        const editor = presence.users.find(
          (u) => u.isEditing && u.userId !== user?.id,
        );
        setUpdatedBy(
          editor ?? {
            nom: 'A collaborator',
            avatarUrl: null,
            userId: '',
            isEditing: false,
          },
        );
      }
    },
  });

  const lockedByOther =
    presence.lockedBy && presence.lockedBy.userId !== user?.id
      ? presence.lockedBy
      : null;

  // ── Editor setup ──────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-lg bg-muted p-4 font-mono text-sm',
          },
        },
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full my-4' },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'border-collapse table-auto w-full' },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: t('placeholder') }),
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-1',
      },
    },
    onUpdate: ({ editor }) => {
      currentContentRef.current = editor.getJSON();
      if (isLoadedRef.current) setHasUnsavedChanges(true);
    },
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing && !lockedByOther);
    if (isEditing && !lockedByOther)
      setTimeout(() => editor.commands.focus('end'), 50);
  }, [isEditing, editor, lockedByOther]);

  useEffect(() => {
    if (doc && editor && !isLoadedRef.current) {
      setTitle(doc.titre);
      setIsFavori(doc.isFavori);
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
      if (hasUnsavedChanges && !isSavingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const handleManualSave = useCallback(() => {
    if (!editor || !currentContentRef.current || !isEditing) return;
    saveMutation.mutate({ titre: title, contenu: currentContentRef.current });
  }, [editor, title, isEditing, saveMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleManualSave]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTitleChange(value: string) {
    setTitle(value);
    setTitleConflict(null); // clear conflict banner as user types a new name
    setHasUnsavedChanges(true);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      silentSyncMutation.mutate({ titre: value } as any);
    }, 1500);
  }

  function handleToggleFavori() {
    const newVal = !isFavori;
    setIsFavori(newVal);
    documentApi.toggleFavori(docId).catch(() => setIsFavori(!newVal));
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'documind');
      formData.append('folder', 'documents');
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData },
      );
      const data = await res.json();
      if (data.secure_url) {
        editor?.chain().focus().setImage({ src: data.secure_url }).run();
        setHasUnsavedChanges(true);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  }

  async function handleExitEdit() {
    if (hasUnsavedChanges && currentContentRef.current) {
      try {
        await saveMutation.mutateAsync({
          titre: title,
          contenu: currentContentRef.current,
        });
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status;
        // If it's a title conflict, stay in edit mode so user can fix it
        if (status === 409) return;
      }
    }
    setIsEditing(false);
  }

  async function handleBack() {
    if (hasUnsavedChanges && currentContentRef.current && isEditing) {
      try {
        await saveMutation.mutateAsync({
          titre: title,
          contenu: currentContentRef.current,
        });
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status;
        if (status === 409) {
          // Stay on page so user can resolve the title conflict
          return;
        }
        const ok = window.confirm(t('unsavedWarning'));
        if (!ok) return;
      }
    }
    router.push(`/${locale}/workspace/${workspaceId}/documents`);
  }

  async function handleExport(format: 'pdf' | 'docx' | 'excel') {
    setIsExporting(format);
    try {
      if (format === 'pdf') await documentApi.exportPdf(docId, title);
      if (format === 'docx') await documentApi.exportDocx(docId, title);
      if (format === 'excel') await documentApi.exportExcel(docId, title);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(null);
    }
  }

  async function handleReload() {
    setUpdatedBy(null);
    isLoadedRef.current = false;
    await refetchDoc();
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading || !editor) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const anyPanelOpen = aiPanelOpen || commentsPanelOpen;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex h-full flex-col transition-all duration-300',
          anyPanelOpen ? 'mr-[420px]' : 'mr-0',
        )}
      >
        {/* ── Top bar ── */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleBack}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs">{t('back')}</span>
            </Button>

            {isEditing ? (
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('untitled')}
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground truncate',
                  titleConflict && 'text-destructive',
                )}
              />
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground select-text">
                {title || t('untitled')}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {user && (
              <PresenceAvatars users={presence.users} currentUserId={user.id} />
            )}

            {isEditing && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {titleConflict ? (
                  <span className="text-destructive font-medium">
                    {t('titleConflict')}
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="text-yellow-500 font-medium">
                    {t('unsaved')}
                  </span>
                ) : lastSaved ? (
                  t('saved', {
                    time: formatDistanceToNow(lastSaved, { addSuffix: true }),
                  })
                ) : null}
              </span>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('share')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('share')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCommentsPanel}
                  className={cn(
                    'relative flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all',
                    commentsPanelOpen
                      ? 'bg-orange-500 text-white'
                      : 'border border-orange-400/30 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10',
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('comments')}</span>
                  {openCommentsCount > 0 && (
                    <span
                      className={cn(
                        'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                        commentsPanelOpen
                          ? 'bg-white text-orange-500'
                          : 'bg-orange-500 text-white',
                      )}
                    >
                      {openCommentsCount > 99 ? '99+' : openCommentsCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {commentsPanelOpen ? t('closeComments') : t('openComments')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleAiPanel}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all',
                    aiPanelOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('askAi')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {aiPanelOpen ? t('closeAi') : t('openAi')}
              </TooltipContent>
            </Tooltip>

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
                <TooltipContent>{t('export')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport('pdf')}
                  disabled={!!isExporting}
                >
                  <FileText className="h-3.5 w-3.5 text-red-500" />
                  {t('exportPdf')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport('docx')}
                  disabled={!!isExporting}
                >
                  <FileDown className="h-3.5 w-3.5 text-blue-500" />
                  {t('exportDocx')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onClick={() => handleExport('excel')}
                  disabled={!!isExporting}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  {t('exportExcel')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleFavori}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent',
                    isFavori ? 'text-yellow-500' : 'text-muted-foreground',
                  )}
                >
                  <Star className={cn('h-4 w-4', isFavori && 'fill-yellow-500')} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isFavori ? t('removeFromStarred') : t('addToStarred')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <History className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('versionHistory')}</TooltipContent>
            </Tooltip>

            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleManualSave}
                  disabled={
                    saveMutation.isPending ||
                    (!hasUnsavedChanges && !titleConflict)
                  }
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {saveMutation.isPending ? t('saving') : t('save')}
                  </span>
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExitEdit}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{t('doneEditing')}</span>
                </Button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={canEdit ? -1 : 0}>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!canEdit || !!lockedByOther}
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t('edit')}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>{t('readOnly')}</TooltipContent>
                )}
                {canEdit && lockedByOther && (
                  <TooltipContent>
                    {lockedByOther.nom} is currently editing
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── NEW: Title-conflict banner ── */}
        {titleConflict && (
          <div className="flex shrink-0 items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-xs text-destructive">
              {t('titleConflictBanner', { titre: titleConflict })}
            </p>
            <button
              onClick={handleAutoRename}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              {t('titleConflictAutoRename')}
            </button>
            <button
              onClick={() => setTitleConflict(null)}
              className="text-xs text-destructive/70 underline-offset-2 hover:underline"
            >
              {t('titleConflictDismiss')}
            </button>
          </div>
        )}

        {lockedByOther && !isEditing && (
          <LockBanner lockedBy={lockedByOther} variant="locked" />
        )}
        {updatedBy && !isEditing && (
          <LockBanner
            lockedBy={updatedBy}
            variant="updated"
            onReloadRequest={handleReload}
          />
        )}

        {isEditing && (
          <EditorToolbar editor={editor} onImageUpload={handleImageUpload} />
        )}

        <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent">
          <div className="mx-auto max-w-3xl px-8 py-10">
            <EditorContent editor={editor} />
          </div>
          {isEditing && editor && (
            <InlineAiMenu editor={editor} workspaceId={workspaceId} />
          )}
        </div>

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

      <AiChatPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        workspaceId={workspaceId}
        docId={docId}
        docTitle={title}
        mode="document"
      />

      <CommentsPanel
        open={commentsPanelOpen}
        onClose={() => setCommentsPanelOpen(false)}
        documentId={docId}
        currentUserId={user?.id ?? ''}
        currentUserRole={workspace?.monRole ?? 'LECTEUR'}
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