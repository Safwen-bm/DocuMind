// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\page.tsx

"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { documentApi } from "@/lib/document.api";
import { workspaceApi } from "@/lib/workspace.api";
import { Document, Dossier, Workspace } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronRight,
  Loader2,
  Upload,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  File,
  Wand2,
} from "lucide-react";
import { FolderTree, getFolderPath } from "./_components/FolderTree";
import { DocumentGrid } from "./_components/DocumentGrid";
import { GenerateDocModal } from "./_components/GenerateDocModal";
import { NewDocumentModal } from "./_components/NewDocumentModal";
import { toast } from "sonner";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const ACCEPTED_EXT = [
  ".pdf", ".doc", ".docx", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
];
const MAX_SIZE_MB = 20;

export default function DocumentsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("dashboard.documents");
  const tDashboard = useTranslations("dashboard");

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  // ── NEW: replaces createDocOpen ───────────────────────────────────────────
  const [newDocModalOpen, setNewDocModalOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  // ── NEW: pre-filled description when coming from template AI tab ──────────
  const [generatePrefill, setGeneratePrefill] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isImageUpload, setIsImageUpload] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  const { data: folders = [] } = useQuery<Dossier[]>({
    queryKey: ["folders", workspaceId],
    queryFn: () => documentApi.getFolders(workspaceId),
  });

  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ["docs", workspaceId, "all"],
    queryFn: () => documentApi.getAll(workspaceId),
    staleTime: 0,
  });

  const { data: filteredDocuments = [], isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["docs", workspaceId, "folder", selectedFolder ?? "root"],
    queryFn: () =>
      selectedFolder !== null
        ? documentApi.getAll(workspaceId, selectedFolder)
        : documentApi.getAll(workspaceId),
    staleTime: 0,
  });

  const canEdit = workspace
    ? ["EDITEUR", "ADMINISTRATEUR", "PROPRIETAIRE"].includes(workspace.monRole)
    : false;

  const createFolderMutation = useMutation({
    mutationFn: () =>
      documentApi.createFolder(workspaceId, { nom: newFolderName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] });
      setCreateFolderOpen(false);
      setNewFolderName("");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      documentApi.uploadFile(workspaceId, file, selectedFolder),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] });
      setIsUploading(false);
      setIsImageUpload(false);
      toast.success(t("uploadSuccess", { name: doc.titre }));
      router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`);
    },
    onError: () => {
      setIsUploading(false);
      setIsImageUpload(false);
      toast.error(t("uploadError"));
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_MIME.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
      toast.error(t("uploadTypeError"));
      e.target.value = "";
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(t("uploadSizeError"));
      e.target.value = "";
      return;
    }
    const isImage =
      file.type.startsWith("image/") ||
      [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );
    setIsImageUpload(isImage);
    setIsUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  }

  // ── NEW: called from NewDocumentModal AI tab ──────────────────────────────
  function handleOpenGenerateWithPrefill(description: string) {
    setGeneratePrefill(description);
    setGenerateOpen(true);
  }

  const breadcrumbPath = selectedFolder
    ? getFolderPath(folders, selectedFolder)
    : [];
  const selectedFolderName = breadcrumbPath[breadcrumbPath.length - 1]?.nom;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full">
        <FolderTree
          workspaceId={workspaceId}
          locale={locale}
          folders={folders}
          allDocuments={allDocuments}
          selectedFolderId={selectedFolder}
          canEdit={canEdit}
          onSelectFolder={(id) => {
            setSelectedFolder(id);
            setActiveTag(null);
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Breadcrumb bar */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3">
            <div className="flex min-w-0 items-center gap-1 text-sm">
              <button
                onClick={() => { setSelectedFolder(null); setActiveTag(null); }}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("breadcrumb")}
              </button>
              {breadcrumbPath.map((folder, i) => (
                <span key={folder.id} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <button
                    onClick={() => setSelectedFolder(folder.id)}
                    className={
                      i === breadcrumbPath.length - 1
                        ? "truncate font-medium text-foreground"
                        : "truncate text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {folder.nom}
                  </button>
                </span>
              ))}
            </div>

            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => { setGeneratePrefill(""); setGenerateOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-xs font-medium text-violet-600 transition-all hover:border-violet-500/50 hover:bg-violet-500/10 dark:text-violet-400"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {tDashboard("generate.button")}
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isUploading
                      ? isImageUpload
                        ? t("uploadImageProcessing")
                        : t("uploading")
                      : t("upload")}
                  </span>
                </Button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />

          <DocumentGrid
            workspaceId={workspaceId}
            locale={locale}
            documents={filteredDocuments}
            folders={folders}
            selectedFolderId={selectedFolder}
            selectedFolderName={selectedFolderName}
            isLoading={docsLoading}
            canEdit={canEdit}
            onCreateDoc={() => setNewDocModalOpen(true)}
            onCreateFolder={() => setCreateFolderOpen(true)}
            activeTag={activeTag}
            onTagClick={(tag) => setActiveTag(tag)}
          />
        </div>
      </div>

      {/* ── NEW: Template picker modal ── */}
      <NewDocumentModal
        open={newDocModalOpen}
        onClose={() => setNewDocModalOpen(false)}
        workspaceId={workspaceId}
        dossierId={selectedFolder}
        onOpenGenerate={handleOpenGenerateWithPrefill}
      />

      {/* ── Create Folder modal (unchanged) ── */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createFolderModal.title")}</DialogTitle>
            <DialogDescription>{t("createFolderModal.desc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createFolderMutation.mutate();
            }}
            className="mt-2 space-y-4"
          >
            <Input
              placeholder={t("createFolderModal.placeholder")}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateFolderOpen(false)}>
                {t("createFolderModal.cancel")}
              </Button>
              <Button type="submit" disabled={createFolderMutation.isPending || !newFolderName.trim()}>
                {createFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createFolderModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Generate with AI modal — now accepts prefill ── */}
      <GenerateDocModal
        open={generateOpen}
        onClose={() => { setGenerateOpen(false); setGeneratePrefill(""); }}
        workspaceId={workspaceId}
        dossierId={selectedFolder ?? undefined}
        prefillDescription={generatePrefill}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] });
        }}
      />
    </TooltipProvider>
  );
}

export function ExportDropdown({
  docId,
  docTitre,
  t,
}: {
  docId: string;
  docTitre: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [loadingFormat, setLoadingFormat] = useState<"pdf" | "docx" | "excel" | null>(null);

  async function handleExport(format: "pdf" | "docx" | "excel") {
    setLoadingFormat(format);
    try {
      if (format === "pdf") await documentApi.exportPdf(docId, docTitre);
      if (format === "docx") await documentApi.exportDocx(docId, docTitre);
      if (format === "excel") await documentApi.exportExcel(docId, docTitre);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportError"));
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {loadingFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          <span className="hidden sm:inline">{t("download")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t("downloadAs")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={loadingFormat !== null} className="gap-2">
          <File className="h-4 w-4 text-red-500" />PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("docx")} disabled={loadingFormat !== null} className="gap-2">
          <FileText className="h-4 w-4 text-blue-500" />Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")} disabled={loadingFormat !== null} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}