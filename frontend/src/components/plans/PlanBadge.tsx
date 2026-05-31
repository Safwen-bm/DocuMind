"use client";

import { useTranslations } from "next-intl";
import { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles, Zap } from "lucide-react";

const styleMap: Record<Plan, { className: string; icon?: any }> = {
  FREE:       { className: "bg-muted text-muted-foreground" },
  PRO:        { className: "bg-violet-500/10 text-violet-600 dark:text-violet-400", icon: Zap },
  ENTERPRISE: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Sparkles },
};

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  const t = useTranslations("dashboard.plans.badges");
  const { className: base, icon: Icon } = styleMap[plan];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", base, className)}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {t(plan)}
    </span>
  );
}