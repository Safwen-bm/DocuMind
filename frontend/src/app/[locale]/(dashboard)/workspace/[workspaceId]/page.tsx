"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { workspaceApi } from "@/lib/workspace.api"
import { Workspace } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Settings, FileText, Calendar, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const t = useTranslations("dashboard")

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workspace) return null

  const quickLinks = [
    {
      icon: Users,
      label: t("workspace.membersNav"),
      desc: `${workspace._count.membres} ${t("workspace.membersCount")}`,
      href: `/${locale}/workspace/${workspaceId}/members`,
    },
    {
      icon: Settings,
      label: t("workspace.settingsNav"),
      desc: "Name, description, danger zone",
      href: `/${locale}/workspace/${workspaceId}/settings`,
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{workspace.nom}</h1>
            {workspace.description && (
              <p className="mt-2 text-muted-foreground">{workspace.description}</p>
            )}
          </div>
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", roleColors[workspace.monRole])}>
            {t(`workspace.roles.${workspace.monRole}`)}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {workspace._count.membres} {t("workspace.membersCount")}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(workspace.dateCreation).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <link.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{link.label}</p>
                <p className="text-sm text-muted-foreground">{link.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {/* Documents coming soon */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-dashed border-border p-5 text-muted-foreground">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t("workspace.documentsNav")}</p>
          <p className="text-sm">Coming in Sprint 3</p>
        </div>
      </div>
    </div>
  )
}