//C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\documents\_components\FolderTree.tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { documentApi } from "@/lib/document.api"
import { Dossier, Document } from "@/lib/types"
import { Input } from "@/components/ui/input"
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
} from "@/components/ui/dropdown-menu"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FolderOpen, Folder, FolderPlus, MoreHorizontal,
  Edit2, Trash2, Loader2, FileText, MoveRight,
  ChevronRight, Star, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────

export interface FolderNode extends Dossier {
  children: FolderNode[]
}

interface FolderTreeProps {
  workspaceId: string
  locale: string
  folders: Dossier[]
  allDocuments: Document[]
  selectedFolderId: string | null
  selectedDocId?: string
  canEdit: boolean
  onSelectFolder: (id: string | null) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function buildTree(folders: Dossier[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  folders.forEach(f => map.set(f.id, { ...f, children: [] }))

  const roots: FolderNode[] = []
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function sortNodes(nodes: FolderNode[]) {
    nodes.sort((a, b) => a.nom.localeCompare(b.nom))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

export function getFolderPath(folders: Dossier[], targetId: string): Dossier[] {
  const map = new Map<string, Dossier>()
  folders.forEach(f => map.set(f.id, f))

  const path: Dossier[] = []
  let current = map.get(targetId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? map.get(current.parentId) : undefined
  }
  return path
}

// ── Document row in tree ──────────────────────────────────────────────────

function DocTreeItem({
  doc, locale, workspaceId, selectedDocId, canEdit, depth,
}: {
  doc: Document
  locale: string
  workspaceId: string
  selectedDocId?: string
  canEdit: boolean
  depth: number
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations("dashboard.documents")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isActive = selectedDocId === doc.id
  const indent = depth * 12 + 28

  const deleteMutation = useMutation({
    mutationFn: () => documentApi.delete(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
      setConfirmDelete(false)
      if (isActive) router.push(`/${locale}/workspace/${workspaceId}/documents`)
    },
  })

  const toggleFavMutation = useMutation({
    mutationFn: () => documentApi.toggleFavori(doc.id, !doc.estFavori),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
    },
  })

  return (
    <>
      <div className="group relative">
        <button
          onClick={() =>
            router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)
          }
          className={cn(
            "flex w-full items-center gap-1.5 py-1 pr-8 text-sm transition-colors rounded-md",
            isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          style={{ paddingLeft: `${indent}px` }}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate flex-1 text-left text-xs">{doc.titre}</span>
          {doc.estFavori && (
            <Star className="h-3 w-3 shrink-0 text-yellow-500 fill-yellow-500 mr-1" />
          )}
        </button>

        <div
          className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => toggleFavMutation.mutate()}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-accent",
              doc.estFavori ? "text-yellow-500" : "text-muted-foreground"
            )}
          >
            <Star className={cn("h-3 w-3", doc.estFavori && "fill-yellow-500")} />
          </button>
          {canEdit && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteDocModal.title")}</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{doc.titre}</span>{" "}
              {t("deleteDocModal.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("deleteDocModal.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteDocModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Folder node (recursive) ───────────────────────────────────────────────

function FolderNodeItem({
  node, allFolders, allDocuments, locale, selectedFolderId, selectedDocId,
  workspaceId, canEdit, depth, onSelectFolder, onCreateSubfolder,
}: {
  node: FolderNode
  allFolders: Dossier[]
  allDocuments: Document[]
  locale: string
  selectedFolderId: string | null
  selectedDocId?: string
  workspaceId: string
  canEdit: boolean
  depth: number
  onSelectFolder: (id: string | null) => void
  onCreateSubfolder: (parentId: string) => void
}) {
  const t = useTranslations("dashboard.documents")
  const queryClient = useQueryClient()

  const docsInFolder = allDocuments.filter(d => d.dossierId === node.id)
  const hasContent = node.children.length > 0 || docsInFolder.length > 0
  const isSelected = selectedFolderId === node.id
  const indent = depth * 12

  const shouldAutoExpand = isSelected || docsInFolder.some(d => d.id === selectedDocId)
  const [expanded, setExpanded] = useState(shouldAutoExpand)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(node.nom)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const renameMutation = useMutation({
    mutationFn: () => documentApi.updateFolder(workspaceId, node.id, renameVal.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      setRenaming(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => documentApi.deleteFolder(workspaceId, node.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["recent-docs"] })
      queryClient.invalidateQueries({ queryKey: ["favori-docs"] })
      if (isSelected) onSelectFolder(null)
      setConfirmDelete(false)
    },
  })

  const moveMutation = useMutation({
    mutationFn: (parentId: string | null) =>
      documentApi.moveFolder(workspaceId, node.id, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
    },
  })

  const moveTargets = allFolders.filter(f => f.id !== node.id)

  return (
    <>
      <div className="group relative">
        <button
          onClick={() => {
            onSelectFolder(isSelected ? null : node.id)
            setExpanded(prev => !prev)
          }}
          className={cn(
            "flex w-full items-center gap-1.5 py-1.5 pr-8 text-sm transition-colors rounded-md",
            isSelected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 transition-transform text-muted-foreground/60",
              hasContent ? "opacity-100" : "opacity-0",
              expanded && "rotate-90"
            )}
          />
          {(isSelected || expanded)
            ? <FolderOpen className="h-4 w-4 shrink-0" />
            : <Folder className="h-4 w-4 shrink-0" />
          }
          <span className="truncate flex-1 text-left">{node.nom}</span>
          {!expanded && (docsInFolder.length > 0 || node.children.length > 0) && (
            <span className="ml-auto text-xs text-muted-foreground/60 tabular-nums">
              {docsInFolder.length > 0 && <span>{docsInFolder.length}</span>}
              {docsInFolder.length > 0 && node.children.length > 0 && <span> · </span>}
              {node.children.length > 0 && <span>{node.children.length}📁</span>}
            </span>
          )}
        </button>

        {/* Folder action menu — "New Subfolder" lives here */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">

              {/* New subfolder — top of menu, most likely action */}
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => {
                  setExpanded(true)
                  onCreateSubfolder(node.id)
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                {t("newSubfolder")}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => { setRenameVal(node.nom); setRenaming(true) }}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {t("tooltips.rename")}
              </DropdownMenuItem>

              {/* Move to submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                  <MoveRight className="h-3.5 w-3.5" />
                  {t("tooltips.move")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                  {node.parentId && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer"
                      onClick={() => moveMutation.mutate(null)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {t("moveToRoot")}
                    </DropdownMenuItem>
                  )}
                  {moveTargets
                    .filter(f => f.id !== node.parentId)
                    .map(f => (
                      <DropdownMenuItem
                        key={f.id}
                        className="gap-2 cursor-pointer"
                        onClick={() => moveMutation.mutate(f.id)}
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.nom}</span>
                      </DropdownMenuItem>
                    ))
                  }
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("tooltips.delete")}
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children: subfolders then docs */}
      {expanded && (
        <div>
          {node.children.map(child => (
            <FolderNodeItem
              key={child.id}
              node={child}
              allFolders={allFolders}
              allDocuments={allDocuments}
              locale={locale}
              selectedFolderId={selectedFolderId}
              selectedDocId={selectedDocId}
              workspaceId={workspaceId}
              canEdit={canEdit}
              depth={depth + 1}
              onSelectFolder={onSelectFolder}
              onCreateSubfolder={onCreateSubfolder}
            />
          ))}
          {docsInFolder.map(doc => (
            <DocTreeItem
              key={doc.id}
              doc={doc}
              locale={locale}
              workspaceId={workspaceId}
              selectedDocId={selectedDocId}
              canEdit={canEdit}
              depth={depth + 1}
            />
          ))}
          {!hasContent && (
            <p
              className="text-xs text-muted-foreground/40 py-1 italic"
              style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
            >
              {t("emptyFolder")}
            </p>
          )}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameFolderModal.title")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); renameMutation.mutate() }}
            className="mt-2 space-y-4"
          >
            <Input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>
                {t("renameFolderModal.cancel")}
              </Button>
              <Button type="submit" disabled={renameMutation.isPending}>
                {renameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("renameFolderModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm with cascade warning */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteFolderModal.title")}</DialogTitle>
            <DialogDescription className="space-y-2">
              <span>
                <span className="font-medium text-foreground">{node.nom}</span>{" "}
                {t("deleteFolderModal.desc")}
              </span>
              {(docsInFolder.length > 0 || node.children.length > 0) && (
                <span className="mt-2 block rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
                  ⚠️{" "}
                  {docsInFolder.length > 0 && `${docsInFolder.length} document${docsInFolder.length > 1 ? "s" : ""} `}
                  {docsInFolder.length > 0 && node.children.length > 0 && "and "}
                  {node.children.length > 0 && `${node.children.length} subfolder${node.children.length > 1 ? "s" : ""} `}
                  {t("willBeDeleted")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("deleteFolderModal.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteFolderModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Root export ───────────────────────────────────────────────────────────

export function FolderTree({
  workspaceId, locale, folders, allDocuments,
  selectedFolderId, selectedDocId, canEdit, onSelectFolder,
}: FolderTreeProps) {
  const t = useTranslations("dashboard.documents")
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newParentId, setNewParentId] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      documentApi.createFolder(workspaceId, {
        nom: newName.trim(),
        parentId: newParentId ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", workspaceId] })
      setCreateOpen(false)
      setNewName("")
      setNewParentId(null)
    },
  })

  const tree = buildTree(folders)
  const rootDocs = allDocuments.filter(d => !d.dossierId)

  const handleCreateFolder = (parentId: string | null = null) => {
    setNewParentId(parentId)
    setCreateOpen(true)
  }

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border lg:flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("explorer")}
          </span>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCreateFolder(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("newFolder")}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Tree scroll area */}
        <div className="flex-1 overflow-y-auto py-1 px-1">

          {/* All Documents entry */}
          <button
            onClick={() => onSelectFolder(null)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md mb-0.5",
              selectedFolderId === null && !selectedDocId
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("allDocuments")}</span>
            {allDocuments.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground/70 tabular-nums">
                {allDocuments.length}
              </span>
            )}
          </button>

          {/* Folder tree with inline documents */}
          {tree.map(node => (
            <FolderNodeItem
              key={node.id}
              node={node}
              allFolders={folders}
              allDocuments={allDocuments}
              locale={locale}
              selectedFolderId={selectedFolderId}
              selectedDocId={selectedDocId}
              workspaceId={workspaceId}
              canEdit={canEdit}
              depth={0}
              onSelectFolder={onSelectFolder}
              onCreateSubfolder={handleCreateFolder}
            />
          ))}

          {/* Root-level documents (not in any folder) */}
          {rootDocs.length > 0 && (
            <div className="mt-1">
              {folders.length > 0 && (
                <p className="px-3 pt-2 pb-0.5 text-xs text-muted-foreground/50 uppercase tracking-wider">
                  {t("unfiled")}
                </p>
              )}
              {rootDocs.map(doc => (
                <DocTreeItem
                  key={doc.id}
                  doc={doc}
                  locale={locale}
                  workspaceId={workspaceId}
                  selectedDocId={selectedDocId}
                  canEdit={canEdit}
                  depth={0}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && allDocuments.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground/50 text-center">
              {t("noFoldersYet")}
            </p>
          )}
        </div>
      </aside>

      {/* Create / new subfolder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createFolderModal.title")}</DialogTitle>
            <DialogDescription>
              {newParentId ? t("createFolderModal.descSub") : t("createFolderModal.desc")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); createMutation.mutate() }}
            className="mt-2 space-y-4"
          >
            <Input
              placeholder={t("createFolderModal.placeholder")}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("createFolderModal.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createFolderModal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}