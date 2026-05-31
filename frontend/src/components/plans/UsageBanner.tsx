"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { plansApi } from "@/lib/plans.api";
import { PlanBadge } from "./PlanBadge";
import { cn } from "@/lib/utils";

function UsageBar({ label, current, limit, isUnlimited }: {
  label: string; current: number; limit: number; isUnlimited: boolean;
}) {
  if (isUnlimited) return null;
  const pct = Math.min((current / limit) * 100, 100);
  const isWarning = pct >= 80;
  const isFull = pct >= 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isFull ? "text-destructive" : isWarning ? "text-amber-500" : "text-foreground")}>
          {current} / {limit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all",
          isFull ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
        )} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function UsageBanner({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("dashboard.plans.usage");
  const { data: usage } = useQuery({
    queryKey: ["plan-usage", workspaceId],
    queryFn: () => plansApi.getUsage(workspaceId),
    staleTime: 30_000,
  });

  if (!usage || usage.plan === "ENTERPRISE") return null;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{t("title")}</span>
        <PlanBadge plan={usage.plan} />
      </div>
      <UsageBar label={t("documents")} current={usage.documents.current} limit={usage.documents.limit} isUnlimited={usage.documents.isUnlimited} />
      <UsageBar label={t("members")} current={usage.members.current} limit={usage.members.limit} isUnlimited={usage.members.isUnlimited} />
      <UsageBar label={t("aiToday")} current={usage.aiToday.current} limit={usage.aiToday.limit} isUnlimited={usage.aiToday.isUnlimited} />
    </div>
  );
}