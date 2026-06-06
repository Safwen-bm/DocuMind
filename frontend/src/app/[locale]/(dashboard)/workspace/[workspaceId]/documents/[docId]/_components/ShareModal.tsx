"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { shareApi, ShareLink } from "@/lib/share.api"
import { X, Link2, Copy, Check, Trash2, Eye, Loader2, Globe } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ShareModalProps {
  open: boolean
  onClose: () => void
  documentId: string
  documentTitle: string
}

export function ShareModal({ open, onClose, documentId, documentTitle }: ShareModalProps) {
  const t = useTranslations("dashboard.share")
  const queryClient = useQueryClient()
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const { data: links = [], isLoading } = useQuery<ShareLink[]>({
    queryKey: ["share-links", documentId],
    queryFn: () => shareApi.getLinks(documentId),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () => shareApi.createLink(documentId, "READ", expiresInDays),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links", documentId] }),
  })

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => shareApi.revokeLink(tokenId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links", documentId] }),
  })

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
    toast.success(t("copied"))
  }

  async function handleCreate() {
    const res = await createMutation.mutateAsync()
    await navigator.clipboard.writeText(res.url)
    toast.success(t("copied"))
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("title")}</p>
                <p className="max-w-[240px] truncate text-xs text-muted-foreground">{documentTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Create new link */}
          <div className="border-b border-border p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("createLink")}</p>

            {/* Read-only badge */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-semibold text-foreground">{t("permissionRead")}</p>
                <p className="text-[10px] text-muted-foreground">{t("permissionReadDesc")}</p>
              </div>
            </div>

            {/* Expiry */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground shrink-0">{t("expiry")}</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: t("never"), value: undefined },
                  { label: "7j", value: 7 },
                  { label: "30j", value: 30 },
                  { label: "90j", value: 90 },
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiresInDays(opt.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                      expiresInDays === opt.value
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t("generate")}
            </button>
          </div>

          {/* Existing links */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("activeLinks")}</p>
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && links.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">{t("noLinks")}</p>
            )}
            <div className="space-y-2">
              {links.map(link => (
                <div key={link.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{t("permissionRead")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {link.expiresAt
                        ? t("expiresOn", { date: new Date(link.expiresAt).toLocaleDateString() })
                        : t("neverExpires")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(link.token)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {copiedToken === link.token
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => revokeMutation.mutate(link.id)}
                      disabled={revokeMutation.isPending}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}