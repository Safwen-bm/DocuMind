//C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\_components\DocumentGrid.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { documentApi } from "@/lib/document.api"
import { Document, Dossier } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
  File, FileSpreadsheet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

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
}

// ── Export dropdown — PDF / Word / Excel ─────────────────────────────────────
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
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
          title={t("download")}
        >
          {loadingFormat
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />
          }
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("downloadAs")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleExport("pdf")}
          disabled={loadingFormat !== null}
          className="gap-2 cursor-pointer"
        >
          <File className="h-3.5 w-3.5 text-red-500" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("docx")}
          disabled={loadingFormat !== null}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5 text-blue-500" />
          Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("excel")}
          disabled={loadingFormat !== null}
          className="gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────
export function DocumentGrid({
  workspaceId, locale, documents, folders, selectedFolderId,
  selectedFolderName, isLoading, canEdit, onCreateDoc, onCreateFolder,
}: DocumentGridProps) {
  const t = useTranslations("dashboard.documents")
  const router = useRouter()
  const queryClient = useQueryClient()

  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)

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
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      documentApi.toggleFavori(id, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
    },
  })

  const moveDocMutation = useMutation({
    mutationFn: ({ id, dossierId }: { id: string; dossierId: string | null }) =>
      documentApi.moveDocument(id, dossierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
    },
  })

  const moveTargetFolders = folders.filter(f => f.id !== selectedFolderId)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {selectedFolderName ?? t("allDocuments")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {documents?.length ?? 0} {t("documentsCount")}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs lg:hidden"
              onClick={onCreateFolder}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {t("folder")}
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={onCreateDoc}>
              <Plus className="h-3.5 w-3.5" />
              {t("newDocument")}
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {selectedFolderName
                ? t("noDocsInFolder", { folder: selectedFolderName })
                : t("noDocsYet")}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {canEdit ? t("createFirstDesc") : t("readOnlyDesc")}
            </p>
            {canEdit && (
              <Button className="mt-5 gap-2" onClick={onCreateDoc}>
                <Plus className="h-4 w-4" />
                {t("createDoc")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                onClick={() =>
                  router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)
                }
              >
                {/* Card body */}
                <div className="flex items-start gap-3 mb-3">
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
                        <span className="text-xs text-muted-foreground truncate">
                          {doc.dossier.nom}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {doc.author.nom.split(" ")[0]}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(doc.dateMiseAJour), { addSuffix: true })}
                  </span>
                </div>

                {/* Action overlay — stops click propagation to card */}
                <div
                  className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Star / unstar */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() =>
                          toggleFavoriMutation.mutate({ id: doc.id, val: !doc.estFavori })
                        }
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-accent",
                          doc.estFavori ? "text-yellow-500" : "text-muted-foreground"
                        )}
                      >
                        <Star className={cn("h-3.5 w-3.5", doc.estFavori && "fill-yellow-500")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {doc.estFavori ? t("tooltips.unstar") : t("tooltips.star")}
                    </TooltipContent>
                  </Tooltip>

                  {/* ── NEW: Download PDF / Word / Excel ── */}
                  <ExportDropdown docId={doc.id} docTitre={doc.titre} />

                  {/* More actions — move + delete (EDITEUR+ only) */}
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                            <MoveRight className="h-3.5 w-3.5" />
                            {t("tooltips.move")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                            {doc.dossierId && (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() =>
                                  moveDocMutation.mutate({ id: doc.id, dossierId: null })
                                }
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {t("moveToRoot")}
                              </DropdownMenuItem>
                            )}
                            {moveTargetFolders.map(f => (
                              <DropdownMenuItem
                                key={f.id}
                                className="gap-2 cursor-pointer"
                                onClick={() =>
                                  moveDocMutation.mutate({ id: doc.id, dossierId: f.id })
                                }
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
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("tooltips.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
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
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>
              {t("deleteDocModal.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDoc && deleteDocMutation.mutate(deleteDoc.id)}
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("deleteDocModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}