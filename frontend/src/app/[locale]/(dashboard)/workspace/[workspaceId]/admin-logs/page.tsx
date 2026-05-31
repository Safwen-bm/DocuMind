"use client"

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\admin-logs\page.tsx

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { format, parseISO, formatDistanceToNow } from "date-fns"
import { fr, ar, enUS } from "date-fns/locale"
import { activiteApi, AdminLogsResult } from "@/lib/activite.api"
import { workspaceApi } from "@/lib/workspace.api"
import { ActionType } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Edit3,
  FolderPlus,
  FolderMinus,
  UserPlus,
  Users,
  Clock,
  RotateCcw,
  Heart,
  Filter,
  X,
  AlertTriangle,
  Activity,
  TrendingUp,
  Calendar,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Action metadata ────────────────────────────────────────────────────────

const ACTION_META: Record<
  ActionType,
  {
    icon: React.ElementType
    color: string
    bg: string
    severity: "info" | "warning" | "success" | "danger"
  }
> = {
  DOCUMENT_CREE:     { icon: FileText,   color: "text-blue-500",    bg: "bg-blue-500/10",    severity: "success" },
  DOCUMENT_MODIFIE:  { icon: Edit3,      color: "text-amber-500",   bg: "bg-amber-500/10",   severity: "info"    },
  DOCUMENT_SUPPRIME: { icon: Trash2,     color: "text-rose-500",    bg: "bg-rose-500/10",    severity: "danger"  },
  DOCUMENT_FAVORI:   { icon: Heart,      color: "text-pink-500",    bg: "bg-pink-500/10",    severity: "info"    },
  DOSSIER_CREE:      { icon: FolderPlus, color: "text-emerald-500", bg: "bg-emerald-500/10", severity: "success" },
  DOSSIER_SUPPRIME:  { icon: FolderMinus,color: "text-rose-500",    bg: "bg-rose-500/10",    severity: "danger"  },
  MEMBRE_INVITE:     { icon: UserPlus,   color: "text-violet-500",  bg: "bg-violet-500/10",  severity: "warning" },
  MEMBRE_REJOINT:    { icon: Users,      color: "text-cyan-500",    bg: "bg-cyan-500/10",    severity: "success" },
  VERSION_RESTAUREE: { icon: RotateCcw,  color: "text-orange-500",  bg: "bg-orange-500/10",  severity: "warning" },
}

const SEVERITY_BORDER: Record<string, string> = {
  info:    "border-l-amber-400/60",
  warning: "border-l-violet-400/60",
  success: "border-l-emerald-400/60",
  danger:  "border-l-rose-400/60",
}

// ─── Types ───────────────────────────────────────────────────────────────────

type LogEntry = AdminLogsResult["logs"][number]

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, iconColor, iconBg, label, value, loading,
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  label: string
  value: number | string
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3.5">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div>
        {loading ? (
          <>
            <div className="h-5 w-12 animate-pulse rounded bg-muted mb-1" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
          </>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Log row ─────────────────────────────────────────────────────────────────

function LogRow({
  log, locale, t,
}: {
  log: LogEntry
  locale: string
  t: ReturnType<typeof useTranslations>
}) {
  const meta = ACTION_META[log.action] ?? ACTION_META.DOCUMENT_MODIFIE
  const Icon = meta.icon
  const dateFnsLocale = locale === "fr" ? fr : locale === "ar" ? ar : enUS
  const initials = log.user.nom
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border border-border border-l-2 bg-card/60 px-4 py-3.5",
        "hover:bg-card transition-colors duration-150",
        SEVERITY_BORDER[meta.severity],
      )}
    >
      {/* Action icon */}
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
        <Icon className={cn("h-3.5 w-3.5", meta.color)} />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* User avatar + name */}
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              {log.user.avatarUrl && <AvatarImage src={log.user.avatarUrl} />}
              <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">{log.user.nom}</span>
          </div>

          {/* Action label */}
          <span className="text-sm text-muted-foreground">
            {t(`actions.${log.action}` as any)}
          </span>

          {/* Target */}
          {log.cible && (
            <span className="rounded-md bg-muted/80 px-2 py-0.5 text-xs font-medium text-foreground/80 max-w-50 truncate">
              {log.cible}
            </span>
          )}
        </div>

        {/* Email + date row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground/70">{log.user.email}</span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span
            className="text-xs text-muted-foreground/70"
            title={format(parseISO(log.dateCreation), "PPpp", { locale: dateFnsLocale })}
          >
            {formatDistanceToNow(parseISO(log.dateCreation), {
              addSuffix: true,
              locale: dateFnsLocale,
            })}
          </span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground/50 font-mono">
            {format(parseISO(log.dateCreation), "dd MMM yyyy HH:mm", { locale: dateFnsLocale })}
          </span>
        </div>
      </div>

      {/* Severity badge */}
      <div className="shrink-0 mt-0.5">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            meta.severity === "danger"  && "bg-rose-500/10    text-rose-600    dark:text-rose-400",
            meta.severity === "warning" && "bg-violet-500/10  text-violet-600  dark:text-violet-400",
            meta.severity === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            meta.severity === "info"    && "bg-amber-500/10   text-amber-600   dark:text-amber-400",
          )}
        >
          {t(`severity.${meta.severity}` as any)}
        </span>
      </div>
    </div>
  )
}

// ─── Access denied ───────────────────────────────────────────────────────────

function AccessDenied({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 mb-4">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">{t("accessDenied.title")}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{t("accessDenied.description")}</p>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyLogs({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <Activity className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
      <p className="text-xs text-muted-foreground mt-1">{t("empty.description")}</p>
    </div>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(logs: LogEntry[], filename: string) {
  const headers = ["ID", "Action", "User", "Email", "Target", "Date"]
  const rows = logs.map((l) => [
    l.id,
    l.action,
    l.user.nom,
    l.user.email,
    l.cible,
    format(parseISO(l.dateCreation), "yyyy-MM-dd HH:mm:ss"),
  ])
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string
  const currentLocale = useLocale()
  const t = useTranslations("dashboard.adminLogs")
  const dateFnsLocale = currentLocale === "fr" ? fr : currentLocale === "ar" ? ar : enUS

  // Filters
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [action, setAction]         = useState<ActionType | "">("")
  const [userId, setUserId]         = useState("")
  const [dateFrom, setDateFrom]     = useState("")
  const [dateTo, setDateTo]         = useState("")

  // FIX 1: useRef needs an initial value in React 19 / newer @types/react
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Role check ──────────────────────────────────────────────────────────────
  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  })

  const isAuthorized =
    workspace?.monRole === "ADMINISTRATEUR" || workspace?.monRole === "PROPRIETAIRE"

  // ── Summary ─────────────────────────────────────────────────────────────────
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin-logs-summary", workspaceId],
    queryFn: () => activiteApi.getAdminLogsSummary(workspaceId),
    enabled: isAuthorized,
    refetchInterval: 30_000,
  })

  // ── Members dropdown ─────────────────────────────────────────────────────────
  const { data: members } = useQuery({
    queryKey: ["admin-logs-members", workspaceId],
    queryFn: () => activiteApi.getAdminLogsMembers(workspaceId),
    enabled: isAuthorized,
  })

  // ── Logs — FIX 2: explicit return type + placeholderData instead of keepPreviousData ──
  const {
    data: logsData,
    isLoading: logsLoading,
    isFetching,
    refetch,
  } = useQuery<AdminLogsResult>({
    queryKey: ["admin-logs", workspaceId, page, action, userId, search, dateFrom, dateTo],
    queryFn: () =>
      activiteApi.getAdminLogs(workspaceId, {
        page,
        limit: 25,
        action: action || undefined,
        userId: userId || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: isAuthorized,
    placeholderData: (prev) => prev,   // replaces keepPreviousData in TanStack Query v5
  })

  const hasFilters = !!(action || userId || search || dateFrom || dateTo)

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 400)
  }

  function clearFilters() {
    setAction("")
    setUserId("")
    setSearch("")
    setSearchInput("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  function handleExport() {
    if (!logsData?.logs.length) return
    exportToCSV(
      logsData.logs,
      `admin-logs-${workspaceId}-${format(new Date(), "yyyy-MM-dd")}.csv`,
    )
  }

  // Show access denied only once workspace is loaded and role confirmed
  if (workspace && !isAuthorized) {
    return <AccessDenied t={t} />
  }

  const actionTypes: ActionType[] = [
    "DOCUMENT_CREE",
    "DOCUMENT_MODIFIE",
    "DOCUMENT_SUPPRIME",
    "DOCUMENT_FAVORI",
    "DOSSIER_CREE",
    "DOSSIER_SUPPRIME",
    "MEMBRE_INVITE",
    "MEMBRE_REJOINT",
    "VERSION_RESTAUREE",
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10">
            <ShieldCheck className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              {workspace && (
                <span className="font-medium text-foreground/70">{workspace.nom}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500/70" />
                {t("restricted")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {t("refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!logsData?.logs.length}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {t("export")}
          </Button>
        </div>
      </div>

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Activity}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          label={t("stats.totalEvents")}
          value={summary?.total.toLocaleString() ?? 0}
          loading={summaryLoading}
        />
        <StatCard
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          label={t("stats.last24h")}
          value={summary?.last24h ?? 0}
          loading={summaryLoading}
        />
        <StatCard
          icon={TrendingUp}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          label={t("stats.last7d")}
          value={summary?.last7d ?? 0}
          loading={summaryLoading}
        />
        <StatCard
          icon={Users}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          label={t("stats.activeUsers")}
          value={summary?.activeUserCount ?? 0}
          loading={summaryLoading}
        />
      </div>

      {/* ── Action breakdown chips ───────────────────────────────────────────── */}
      {!summaryLoading && summary?.byAction && summary.byAction.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("stats.breakdownLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.byAction.slice(0, 6).map((a) => {
              const meta = ACTION_META[a.action as ActionType]
              const Icon = meta?.icon ?? Activity
              return (
                <button
                  key={a.action}
                  onClick={() => { setAction(a.action as ActionType); setPage(1) }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    "hover:border-primary/40 hover:bg-primary/5",
                    action === a.action && "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  <Icon className={cn("h-3 w-3", meta?.color)} />
                  {t(`actions.${a.action}` as any)}
                  <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {a.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Action type */}
          <Select
            value={action || "ALL"}
            onValueChange={(v) => { setAction(v === "ALL" ? "" : v as ActionType); setPage(1) }}
          >
            <SelectTrigger className="w-45 h-9 text-sm">
              <SelectValue placeholder={t("filters.allActions")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filters.allActions")}</SelectItem>
              {actionTypes.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`actions.${a}` as any)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Member */}
          <Select
            value={userId || "ALL"}
            onValueChange={(v) => { setUserId(v === "ALL" ? "" : v); setPage(1) }}
          >
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder={t("filters.allUsers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("filters.allUsers")}</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.utilisateur.id} value={m.utilisateur.id}>
                  {m.utilisateur.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-35 h-9 text-sm"
            />
            <span className="text-muted-foreground text-xs">{t("filters.to")}</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-35 h-9 text-sm"
            />
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              {t("filters.clear")}
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {t("filters.active")}:
            </span>
            {action && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {t(`actions.${action}` as any)}
                <button onClick={() => { setAction(""); setPage(1) }} className="ml-0.5 hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {userId && members && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <User className="h-2.5 w-2.5" />
                {members.find((m) => m.utilisateur.id === userId)?.utilisateur.nom ?? userId}
                <button onClick={() => { setUserId(""); setPage(1) }} className="ml-0.5 hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Calendar className="h-2.5 w-2.5" />
                {dateFrom && format(new Date(dateFrom), "dd MMM", { locale: dateFnsLocale })}
                {dateFrom && dateTo && " → "}
                {dateTo && format(new Date(dateTo), "dd MMM", { locale: dateFnsLocale })}
                <button onClick={() => { setDateFrom(""); setDateTo(""); setPage(1) }} className="ml-0.5 hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Logs list ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {!logsLoading && logsData && (
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-xs text-muted-foreground">
              {t("results", { count: logsData.total.toLocaleString() })}
              {isFetching && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  {t("updating")}
                </span>
              )}
            </p>
            {logsData.totalPages > 1 && (
              <p className="text-xs text-muted-foreground">
                {t("page", { current: logsData.page, total: logsData.totalPages })}
              </p>
            )}
          </div>
        )}

        {logsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-18 animate-pulse rounded-lg bg-muted/50"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        ) : !logsData?.logs.length ? (
          <EmptyLogs t={t} />
        ) : (
          logsData.logs.map((log) => (
            <LogRow key={log.id} log={log} locale={currentLocale} t={t} />
          ))
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {logsData && logsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t("pagination.prev")}
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(7, logsData.totalPages) }, (_, i) => {
              const totalPages = logsData.totalPages
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                    pageNum === page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(logsData.totalPages, p + 1))}
            disabled={page === logsData.totalPages || isFetching}
            className="gap-1.5"
          >
            {t("pagination.next")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
