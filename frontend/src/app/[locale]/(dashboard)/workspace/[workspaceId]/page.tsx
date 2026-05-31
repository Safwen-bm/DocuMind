// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\page.tsx

"use client"

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations, useLocale } from "next-intl"
import { workspaceApi } from "@/lib/workspace.api"
import { documentApi } from "@/lib/document.api"
import { activiteApi } from "@/lib/activite.api"
import { Workspace, Document, Activite } from "@/lib/types"
import {
  Users, Settings, FileText, Calendar,
  ArrowRight, Activity, Clock, Star, Plus,
  BarChart2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner";
import { fr, ar, enUS } from "date-fns/locale"

const roleConfig: Record<string, { classes: string }> = {
  PROPRIETAIRE: { classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" },
  ADMINISTRATEUR: { classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  EDITEUR: { classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  LECTEUR: { classes: "bg-muted text-muted-foreground border border-border" },
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="h-8 w-8 animate-pulse rounded-lg bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-36 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}

function SkeletonActivity() {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <div className="h-7 w-7 animate-pulse rounded-full bg-muted shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 w-48 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
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

  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      toast.success("🎉 Your workspace has been upgraded successfully!");
      queryClient.invalidateQueries({ queryKey: ["plan-usage", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workspace) return null

  const canEdit = ["EDITEUR", "ADMINISTRATEUR", "PROPRIETAIRE"].includes(workspace.monRole)
  const role = roleConfig[workspace.monRole] ?? roleConfig.LECTEUR

  const quickLinks = [
    {
      icon: FileText,
      label: t("workspace.documentsNav"),
      desc: `${recentDocs?.length ?? 0} ${t("workspace.documentsNav").toLowerCase()}`,
      href: `/${locale}/workspace/${workspaceId}/documents`,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      accent: "hover:border-blue-500/30",
    },
    {
      icon: Users,
      label: t("workspace.membersNav"),
      desc: `${workspace._count.membres} ${tOverview("membersDesc")}`,
      href: `/${locale}/workspace/${workspaceId}/members`,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      accent: "hover:border-emerald-500/30",
    },
    {
      icon: BarChart2,
      label: t("workspace.analyticsNav"),
      desc: tOverview("analyticsDesc"),
      href: `/${locale}/workspace/${workspaceId}/analytics`,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      accent: "hover:border-violet-500/30",
    },
    {
      icon: Settings,
      label: t("workspace.settingsNav"),
      desc: tOverview("settingsDesc"),
      href: `/${locale}/workspace/${workspaceId}/settings`,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      accent: "hover:border-border",
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          {/* Initial avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg select-none">
            {workspace.nom[0].toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {workspace.nom}
              </h1>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", role.classes)}>
                {tRoles(workspace.monRole)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {workspace._count.membres} {tOverview("membersDesc")}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(workspace.dateCreation).toLocaleDateString(
                  currentLocale === "ar" ? "ar-TN" : currentLocale === "fr" ? "fr-FR" : "en-US"
                )}
              </span>
              {recentDocs !== undefined && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {recentDocs.length} {t("workspace.documentsNav").toLowerCase()}
                </span>
              )}
            </div>

            {workspace.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {workspace.description}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <Button
            size="sm"
            className="gap-1.5 hidden sm:flex shrink-0"
            onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
          >
            <Plus className="h-4 w-4" />
            {tOverview("newDocument")}
          </Button>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {quickLinks.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className={cn(
              "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5 text-left",
              "transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5",
              link.accent,
            )}
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", link.iconBg)}>
              <link.icon className={cn("h-4 w-4", link.iconColor)} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground leading-tight">{link.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{link.desc}</p>
            </div>
            <ArrowRight className={cn(
              "absolute top-4 right-4 h-3.5 w-3.5 opacity-0 transition-all duration-200",
              "group-hover:opacity-100 group-hover:translate-x-0.5",
              link.iconColor,
            )} />
          </button>
        ))}
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* Recent documents — 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-medium text-foreground">{tOverview("recentDocs")}</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2"
              onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
            >
              {tOverview("viewAll")}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {!recentDocs ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : recentDocs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <FileText className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">{tOverview("noDocsYet")}</p>
                <p className="text-xs text-muted-foreground mt-1">{tOverview("noDocsDesc")}</p>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 text-xs h-8"
                    onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents`)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {tOverview("createFirst")}
                  </Button>
                )}
              </div>
            ) : (
              recentDocs.slice(0, 6).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`)}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {doc.titre}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span>{doc.author.nom}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(doc.dateMiseAJour), { addSuffix: true, locale: dateFnsLocale })}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.isFavori && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity — 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">{tOverview("recentActivity")}</h3>
          </div>

          <div className="divide-y divide-border/60">
            {!activity ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonActivity key={i} />)
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <Activity className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">{tOverview("noActivityYet")}</p>
                <p className="text-xs text-muted-foreground mt-1">{tOverview("noActivityDesc")}</p>
              </div>
            ) : (
              activity.slice(0, 8).map((item) => {
                const initials = item.user.nom
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      {item.user.avatarUrl && (
                        <AvatarImage src={item.user.avatarUrl} alt={item.user.nom} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground leading-snug">
                        <span className="font-semibold">{item.user.nom}</span>
                        {" "}
                        <span className="text-muted-foreground">
                          {tActions(item.action, { defaultValue: item.action })}
                        </span>
                        {" "}
                        <span className="font-medium text-foreground/80">{item.cible}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
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