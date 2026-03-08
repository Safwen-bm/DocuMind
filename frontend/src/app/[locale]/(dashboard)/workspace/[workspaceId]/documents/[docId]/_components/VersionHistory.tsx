// src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/_components/VersionHistory.tsx

"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Editor } from "@tiptap/react"
import { documentApi } from "@/lib/document.api"
import { VersionDocument } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { History, Loader2, RotateCcw } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { useTranslations } from "next-intl"

interface VersionHistoryProps {
  docId: string
  workspaceId: string
  open: boolean
  onOpenChange: (val: boolean) => void
  editor: Editor
  onRestored: () => void
}

export function VersionHistory({
  docId, workspaceId, open, onOpenChange, editor, onRestored,
}: VersionHistoryProps) {
  const t = useTranslations("dashboard.editor")
  const queryClient = useQueryClient()
  const [restoreVersion, setRestoreVersion] = useState<VersionDocument | null>(null)

  const { data: versions } = useQuery<VersionDocument[]>({
    queryKey: ["versions", docId],
    queryFn: () => documentApi.getVersions(docId),
    enabled: open,
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => documentApi.restoreVersion(docId, versionId),
    onSuccess: restored => {
      editor.commands.setContent(restored.contenu || { type: "doc", content: [] })
      queryClient.invalidateQueries({ queryKey: ["versions", docId] })
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] })
      setRestoreVersion(null)
      onOpenChange(false)
      onRestored()
    },
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
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
                <p className="text-sm font-medium">{t("versionHistoryPanel.noVersions")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("versionHistoryPanel.noVersionsDesc")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map(v => (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      {v.createdBy.avatarUrl && <AvatarImage src={v.createdBy.avatarUrl} />}
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {v.createdBy.nom[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">Version {v.numero}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.createdBy.nom}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(v.dateCreation), "MMM d, yyyy · HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(v.dateCreation), { addSuffix: true })}
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

      {/* Restore confirm dialog */}
      <Dialog open={!!restoreVersion} onOpenChange={() => setRestoreVersion(null)}>
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
              onClick={() => restoreVersion && restoreMutation.mutate(restoreVersion.id)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("restoreModal.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}