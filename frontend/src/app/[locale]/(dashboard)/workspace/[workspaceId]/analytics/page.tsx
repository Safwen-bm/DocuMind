// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\analytics\page.tsx

"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { workspaceApi } from "@/lib/workspace.api"
import { ActionType } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  FileText,
  Users,
  MessageSquare,
  TrendingUp,
  Zap,
  Award,
  BarChart3,
  TrendingDown,
  Minus,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { fr, ar, enUS } from "date-fns/locale"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totals: {
    documents: number
    documentsThisWeek: number
    members: number
    aiQuestions: number
    aiQuestionsThisWeek: number
  }
  docsChart: { date: string; documents: number }[]
  activityChart: { date: string; actions: number }[]
  topMembers: {
    user: { id: string; nom: string; avatarUrl: string | null }
    count: number
  }[]
  actionBreakdown: { action: ActionType; count: number }[]
}

// ─── Action colors ─────────────────────────────────────────────────────────────

const actionColorClasses = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-teal-500",
]

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3.5 py-2.5 shadow-lg text-popover-foreground">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-sm font-semibold">
          {p.value}{" "}
          <span className="text-muted-foreground font-normal">{p.name}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ value, label }: { value: number; label: string }) {
  const isUp = value > 0
  const isFlat = value === 0
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium",
      isFlat
        ? "bg-muted text-muted-foreground"
        : isUp
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    )}>
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{value} {label}
    </span>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, subLabel, subValue, iconBg, iconColor, loading,
}: {
  icon: any; label: string; value: number; subLabel: string; subValue: number
  iconBg: string; iconColor: string; loading: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div>
        {loading ? (
          <>
            <div className="h-8 w-16 animate-pulse rounded-lg bg-muted mb-1" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
          </>
        ) : (
          <>
            <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
          </>
        )}
      </div>
      {!loading && <TrendBadge value={subValue} label={subLabel} />}
    </div>
  )
}

// ─── Chart card ────────────────────────────────────────────────────────────────

function ChartCard({
  icon: Icon, iconColor, title, loading, children,
}: {
  icon: any; iconColor: string; title: string; loading: boolean; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {loading ? <div className="h-48 animate-pulse rounded-lg bg-muted" /> : children}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function WorkspaceAnalyticsPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string
  const currentLocale = useLocale()
  const t = useTranslations("dashboard.analytics")

  const dateFnsLocale = currentLocale === "fr" ? fr : currentLocale === "ar" ? ar : enUS

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", workspaceId],
    queryFn: () => workspaceApi.getAnalytics(workspaceId),
    refetchInterval: 60_000,
  })

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  })

  const docsChartData =
    analytics?.docsChart.map((d) => ({
      ...d,
      label: format(parseISO(d.date), "EEE d", { locale: dateFnsLocale }),
    })) ?? []

  const activityChartData =
    analytics?.activityChart.map((d) => ({
      ...d,
      label: format(parseISO(d.date), "EEE d", { locale: dateFnsLocale }),
    })) ?? []

  const totalActions =
    analytics?.actionBreakdown.reduce((acc, a) => acc + a.count, 0) ?? 1

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">

      {/* ── Page header — matches overview page style exactly ───────────── */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              {workspace && (
                <span className="font-medium text-foreground/70">{workspace.nom}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t("last7Days")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label={t("stats.documents")}
          value={analytics?.totals.documents ?? 0}
          subLabel={t("stats.thisWeek")}
          subValue={analytics?.totals.documentsThisWeek ?? 0}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label={t("stats.members")}
          value={analytics?.totals.members ?? 0}
          subLabel={t("stats.active")}
          subValue={analytics?.topMembers?.length ?? 0}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          loading={isLoading}
        />
        <StatCard
          icon={MessageSquare}
          label={t("stats.aiQuestions")}
          value={analytics?.totals.aiQuestions ?? 0}
          subLabel={t("stats.thisWeek")}
          subValue={analytics?.totals.aiQuestionsThisWeek ?? 0}
          iconBg="bg-violet-500/10"
          iconColor="text-violet-500"
          loading={isLoading}
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard icon={TrendingUp} iconColor="text-blue-500" title={t("charts.documents7days")} loading={isLoading}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={docsChartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="docsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="documents" name={t("stats.documents")} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#docsGradient)" dot={{ fill: "hsl(var(--primary))", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard icon={Zap} iconColor="text-amber-500" title={t("charts.activity7days")} loading={isLoading}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityChartData} barSize={22} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="actions" name={t("actions.title")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Top members */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Award className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-foreground">{t("topMembers.title")}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{t("topMembers.last30Days")}</span>
          </div>

          <div className="divide-y divide-border/60">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
                  </div>
                  <div className="h-3 w-8 animate-pulse rounded-full bg-muted" />
                </div>
              ))
            ) : !analytics?.topMembers.length ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <Users className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">{t("topMembers.empty")}</p>
              </div>
            ) : (
              analytics.topMembers.map((member, index) => {
                const maxCount = analytics.topMembers[0].count
                const pct = Math.round((member.count / maxCount) * 100)
                const initials = member.user.nom.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                const rankColors = ["bg-amber-500", "bg-slate-400", "bg-orange-600"]

                return (
                  <div key={member.user.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8">
                        {member.user.avatarUrl && <AvatarImage src={member.user.avatarUrl} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {index < 3 && (
                        <span className={cn(
                          "absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white text-[8px] font-bold",
                          rankColors[index]
                        )}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{member.user.nom}</p>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums w-7 text-right shrink-0">
                      {member.count}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Action breakdown */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">{t("actions.title")}</h3>
            <span className="ml-auto text-xs text-muted-foreground">{t("actions.last30Days")}</span>
          </div>

          <div className="p-5 space-y-3.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
                </div>
              ))
            ) : !analytics?.actionBreakdown.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">{t("actions.empty")}</p>
              </div>
            ) : (
              analytics.actionBreakdown.slice(0, 6).map((action, index) => {
                const pct = Math.round((action.count / totalActions) * 100)
                const colorClass = actionColorClasses[index % actionColorClasses.length]
                return (
                  <div key={action.action} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", colorClass)} />
                        <span className="text-xs text-foreground truncate">
                          {t(`actions.${action.action}`, { defaultValue: action.action })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-xs font-semibold text-foreground tabular-nums w-6 text-right">
                          {action.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700 ease-out", colorClass)}
                        style={{ width: `${pct}%`, opacity: 0.6 }}
                      />
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