"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations, useLocale } from "next-intl"
import { workspaceApi } from "@/lib/workspace.api"
import { documentApi } from "@/lib/document.api"
import { activiteApi } from "@/lib/activite.api"
import { Workspace, Document, Activite } from "@/lib/types"
import {
  Users, Settings, FileText, Calendar,
  Loader2, ArrowRight, Activity, Clock, Star, Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { fr, ar, enUS } from "date-fns/locale"

const roleColors: Record<string, string> = {
  PROPRIETAIRE: "bg-primary/10 text-primary",
  ADMINISTRATEUR: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  EDITEUR: "bg-green-500/10 text-green-600 dark:text-green-400",
  LECTEUR: "bg-muted text-muted-foreground",
}

export default function WorkspaceOverviewPage() {
  const params = useParams()
  const locale = params.locale as string
  const workspaceId = params.workspaceId as string
  const router = useRouter()
  const currentLocale = useLocale()
  const t = useTranslations("dashboard")
  const tOverview = useTranslations("dashboard.overview")
  const tRoles = useTranslations("dashboard.workspace.roles")
  const tActions = useTranslations("dashboard.home.actions")

  const dateFnsLocale = currentLocale === "fr" ? fr : currentLocale === "ar" ? ar : enUS

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  })

  const { data: recentDocs } = useQuery<Document[]>({
    queryKey: ["docs", workspaceId],
    queryFn: () => documentApi.getAll(workspaceId),
    enabled: !!workspaceId,
  })

  const { data: activity } = useQuery<Activite[]>({
    queryKey: ["activity", workspaceId],
    queryFn: () => activiteApi.getByWorkspace(workspaceId),
    enabled: !!workspaceId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workspace) return null

  const canEdit = ["EDITEUR", "ADMINISTRATEUR", "PROPRIETAIRE"].includes(workspace.monRole)

  const quickLinks = [
    {
      icon: FileText,
      label: t("workspace.documentsNav"),
      desc: `${recentDocs?.length ?? 0} ${t("workspace.documentsNav").toLowerCase()}`,
      href: `/${locale}/workspace/${workspaceId}/documents`,
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      icon: Users,
      label: t("workspace.membersNav"),
      desc: `${workspace._count.membres} ${tOverview("members")}`,
      href: `/${locale}/workspace/${workspaceId}/members`,
      color: "bg-green-500/10 text-green-500",
    },
    {
      icon: Settings,
      label: t("workspace.settingsNav"),
      desc: tOverview("settingsDesc"),
      href: `/${locale}/workspace/${workspaceId}/settings`,
      color: "bg-muted text-muted-foreground",
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
              {workspace.nom[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{workspace.nom}</h1>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", roleColors[workspace.monRole])}>
                {tRoles(workspace.monRole)}
              </span>
            </div>
          </div>
          {workspace.description && (
            <p className="mt-1 text-muted-foreground text-sm max-w-xl">{workspace.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {workspace._count.membres} {tOverview("members")}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(workspace.dateCreation).toLocaleDateString(
                currentLocale === "ar" ? "ar-TN" : currentLocale === "fr" ? "fr-FR" : "en-US"
              )}
            </span>
          </div>
        </div>

        {canEdit && (
          <Button
            size="sm"
            className="gap-2 hidden sm:flex"
            onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
          >
            <Plus className="h-4 w-4" />
            {tOverview("newDocument")}
          </Button>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", link.color)}>
                <link.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {/* Bottom: recent docs + activity */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent documents */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">{tOverview("recentDocs")}</h3>
            </div>
            <Button
              variant="ghost" size="sm"
              className="text-xs h-7"
              onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
            >
              {tOverview("viewAll")}
            </Button>
          </div>
          <div className="divide-y divide-border">
            {!recentDocs ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))
            ) : recentDocs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{tOverview("noDocsYet")}</p>
                {canEdit && (
                  <Button
                    size="sm" variant="outline" className="mt-3 gap-1.5 text-xs"
                    onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {tOverview("createFirst")}
                  </Button>
                )}
              </div>
            ) : (
              recentDocs.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{doc.titre}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.author.nom} · {formatDistanceToNow(new Date(doc.dateMiseAJour), { addSuffix: true, locale: dateFnsLocale })}
                    </p>
                  </div>
                  {doc.estFavori && <Star className="h-3.5 w-3.5 shrink-0 text-yellow-500 fill-yellow-500" />}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{tOverview("recentActivity")}</h3>
          </div>
          <div className="divide-y divide-border">
            {!activity ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">{tOverview("noActivityYet")}</p>
              </div>
            ) : (
              activity.slice(0, 6).map((item) => {
                const initials = item.user.nom
                  .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                return (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      {item.user.avatarUrl && (
                        <AvatarImage src={item.user.avatarUrl} alt={item.user.nom} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{item.user.nom}</span>
                        {" "}
                        <span className="text-muted-foreground">
                          {tActions(item.action, { defaultValue: item.action })}
                        </span>
                        {" "}
                        <span className="font-medium">{item.cible}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.dateCreation), { addSuffix: true, locale: dateFnsLocale })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}