"use client"

import { useParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  Menu, LayoutDashboard, Users, Settings,
  FolderOpen, ChevronRight, User, FileText,
} from "lucide-react"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { workspaceApi } from "@/lib/workspace.api"
import { Workspace } from "@/lib/types"
import { cn } from "@/lib/utils"

interface DashboardHeaderProps {
  onMenuClick: () => void
}

interface BreadcrumbItem {
  label: string
  icon: React.ElementType
  active: boolean
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const params = useParams()
  const pathname = usePathname()
  const locale = params.locale as string
  const workspaceId = params.workspaceId as string | undefined
  const t = useTranslations("dashboard.nav")
  const tProfile = useTranslations("profile")

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
    enabled: !!workspaceId,
  })

  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId)

  function getBreadcrumbs(): BreadcrumbItem[] {
    if (pathname.endsWith("/profile")) {
      return [
        { label: t("dashboard"), icon: LayoutDashboard, active: false },
        { label: tProfile("title"), icon: User, active: true },
      ]
    }
    if (!workspaceId) {
      return [{ label: t("dashboard"), icon: LayoutDashboard, active: true }]
    }

    const wsName = currentWorkspace?.nom ?? "..."
    const base: BreadcrumbItem = { label: wsName, icon: FolderOpen, active: false }

    if (pathname.includes("/documents/") && !pathname.endsWith("/documents")) {
      return [
        base,
        { label: t("documentsNav"), icon: FileText, active: false },
        { label: t("editor"), icon: FileText, active: true },
      ]
    }
    if (pathname.endsWith("/documents")) {
      return [base, { label: t("documentsNav"), icon: FileText, active: true }]
    }
    if (pathname.endsWith("/members")) {
      return [base, { label: t("members"), icon: Users, active: true }]
    }
    if (pathname.endsWith("/settings")) {
      return [base, { label: t("settings"), icon: Settings, active: true }]
    }

    return [{ label: wsName, icon: FolderOpen, active: true }]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <nav className="flex items-center gap-1.5">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
              <div className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium",
                crumb.active ? "bg-primary/8 text-foreground" : "text-muted-foreground"
              )}>
                <crumb.icon className={cn(
                  "h-3.5 w-3.5",
                  crumb.active ? "text-primary" : "text-muted-foreground"
                )} />
                <span>{crumb.label}</span>
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <LanguageSwitcher locale={locale} />
        <ThemeToggle />
      </div>
    </header>
  )
}