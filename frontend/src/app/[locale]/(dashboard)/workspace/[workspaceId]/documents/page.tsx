"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { documentApi } from "@/lib/document.api"
import { workspaceApi } from "@/lib/workspace.api"
import { Document, Dossier, Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FileText, FolderOpen, Folder, Plus, MoreHorizontal,
  Star, Trash2, Loader2, ChevronRight, FolderPlus,
  Edit2, Clock, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export default function DocumentsPage() {
  const params = useParams()
  const locale = params.locale as string
  const workspaceId = params.workspaceId as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations("dashboard.documents")

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [createDocOpen, setCreateDocOpen] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [deleteFolder, setDeleteFolder] = useState<Dossier | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Dossier | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  })

  const { data: folders, isLoading: foldersLoading } = useQuery<Dossier[]>({
    queryKey: ["folders", workspaceId],
    queryFn: () => documentApi.getFolders(workspaceId),
  })

  const { data: documents, isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["docs", workspaceId, selectedFolder],
    queryFn: () => documentApi.getAll(workspaceId, selectedFolder ?? undefined),
  })

  const canEdit = workspace
    ? ["EDITEUR", "ADMINISTRATEUR", "PROPRIETAIRE"].includes(workspace.monRole)
    : false

  const createDocMutation = useMutation({
    mutationFn: () => documentApi.create(workspaceId, {
      titre: newDocTitle.trim() || t("untitled"),
      dossierId: selectedFolder ?? undefined,
    }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      setCreateDocOpen(false)
      setNewDocTitle("")
      router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: () => documentApi.createFolder(workspaceId, { nom: newFolderName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      setCreateFolderOpen(false)
      setNewFolderName("")
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
      setDeleteDoc(null)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => documentApi.deleteFolder(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      if (selectedFolder === deleteFolder?.id) setSelectedFolder(null)
      setDeleteFolder(null)
    },
  })

  const renameFolderMutation = useMutation({
    mutationFn: () => documentApi.updateFolder(workspaceId, renamingFolder!.id, renameValue.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      setRenamingFolder(null)
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

  const currentFolderName = selectedFolder
    ? folders?.find(f => f.id === selectedFolder)?.nom
    : null

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full gap-0">

        {/* Folder Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border lg:flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("folders")}
            </span>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCreateFolderOpen(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t("newFolder")}</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <button
              onClick={() => setSelectedFolder(null)}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors",
                selectedFolder === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("allDocuments")}</span>
              {documents && selectedFolder === null && (
                <span className="ml-auto text-xs text-muted-foreground">{documents.length}</span>
              )}
            </button>

            {foldersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : folders && folders.length > 0 ? (
              folders.filter(f => !f.parentId).map((folder) => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors pr-8",
                      selectedFolder === folder.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {selectedFolder === folder.id
                      ? <FolderOpen className="h-4 w-4 shrink-0" />
                      : <Folder className="h-4 w-4 shrink-0" />
                    }
                    <span className="truncate">{folder.nom}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{folder._count.documents}</span>
                  </button>

                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-40">
                        <DropdownMenuItem
                          onClick={() => { setRenamingFolder(folder); setRenameValue(folder.nom) }}
                          className="gap-2 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          {t("tooltips.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteFolder(folder)}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("tooltips.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            ) : (
              <p className="px-4 py-3 text-xs text-muted-foreground">{t("noFoldersYet")}</p>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-0.5">
                <span
                  className="hover:text-foreground cursor-pointer transition-colors"
                  onClick={() => setSelectedFolder(null)}
                >
                  {t("breadcrumb")}
                </span>
                {currentFolderName && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-foreground font-medium">{currentFolderName}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {documents?.length ?? 0} {t("breadcrumb").toLowerCase()}
              </p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 text-xs lg:hidden"
                  onClick={() => setCreateFolderOpen(true)}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  {t("folder")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setCreateDocOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("newDocument")}
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {docsLoading ? (
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
                  {currentFolderName
                    ? t("noDocsInFolder", { folder: currentFolderName })
                    : t("noDocsYet")}
                </h3>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {canEdit ? t("createFirstDesc") : t("readOnlyDesc")}
                </p>
                {canEdit && (
                  <Button className="mt-5 gap-2" onClick={() => setCreateDocOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t("createDoc")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                    onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)}
                  >
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
                            <span className="text-xs text-muted-foreground truncate">{doc.dossier.nom}</span>
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
                    <div
                      className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleFavoriMutation.mutate({ id: doc.id, val: !doc.estFavori })}
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
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setDeleteDoc(doc)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{t("tooltips.delete")}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Document Modal */}
      <Dialog open={createDocOpen} onOpenChange={setCreateDocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createDocModal.title")}</DialogTitle>
            <DialogDescription>{t("createDocModal.desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createDocMutation.mutate() }} className="mt-2 space-y-4">
            <Input
              placeholder={t("createDocModal.placeholder")}
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateDocOpen(false)}>
                {t("createDocModal.cancel")}
              </Button>
              <Button type="submit" disabled={createDocMutation.isPending}>
                {createDocMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createDocModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Folder Modal */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createFolderModal.title")}</DialogTitle>
            <DialogDescription>{t("createFolderModal.desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createFolderMutation.mutate() }} className="mt-2 space-y-4">
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
              <Button type="submit" disabled={createFolderMutation.isPending}>
                {createFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createFolderModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Modal */}
      <Dialog open={!!renamingFolder} onOpenChange={() => setRenamingFolder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameFolderModal.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); renameFolderMutation.mutate() }} className="mt-2 space-y-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRenamingFolder(null)}>
                {t("renameFolderModal.cancel")}
              </Button>
              <Button type="submit" disabled={renameFolderMutation.isPending}>
                {renameFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("renameFolderModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirm */}
      <Dialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteDocModal.title")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteDoc?.titre}</span> {t("deleteDocModal.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>{t("deleteDocModal.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDoc && deleteDocMutation.mutate(deleteDoc.id)}
              disabled={deleteDocMutation.isPending}
            >
              {deleteDocMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteDocModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirm */}
      <Dialog open={!!deleteFolder} onOpenChange={() => setDeleteFolder(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteFolderModal.title")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteFolder?.nom}</span> {t("deleteFolderModal.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteFolder(null)}>{t("deleteFolderModal.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
              disabled={deleteFolderMutation.isPending}
            >
              {deleteFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteFolderModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}