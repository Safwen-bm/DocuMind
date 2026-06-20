"use client";

// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\pricing\page.tsx

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace.api";
import { plansApi } from "@/lib/plans.api";
import { Button } from "@/components/ui/button";
import { Check, Zap, Sparkles, FolderOpen, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Workspace, Plan } from "@/lib/types";

const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

export default function PricingPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("dashboard.plans.pricing");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
  });

  const ownedWorkspace = workspaces?.find((w) => w.isOwner);

  const { data: usage } = useQuery({
    queryKey: ["plan-usage", ownedWorkspace?.id],
    queryFn: () => plansApi.getUsage(ownedWorkspace!.id),
    enabled: !!ownedWorkspace?.id,
    staleTime: 30_000,
  });

  const currentPlan: Plan = usage?.plan ?? "FREE";

  async function handleUpgrade(planKey: "PRO" | "ENTERPRISE") {
    if (!ownedWorkspace) {
      toast.error(t("noWorkspaceError"));
      return;
    }
    try {
      setLoading(planKey);
      const { url } = await plansApi.createCheckout(ownedWorkspace.id, planKey);
      window.location.href = url;
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setLoading(null);
    }
  }

  const plans = [
    {
      key: "free",
      planKey: "FREE" as Plan,
      icon: FolderOpen,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      border: "border-border",
      checkColor: "text-primary",
      highlight: false,
    },
    {
      key: "pro",
      planKey: "PRO" as Plan,
      icon: Zap,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
      border: "border-violet-500/40",
      checkColor: "text-violet-500",
      highlight: true,
    },
    {
      key: "enterprise",
      planKey: "ENTERPRISE" as Plan,
      icon: Sparkles,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      border: "border-amber-500/40",
      checkColor: "text-amber-500",
      highlight: false,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map(({ key, planKey, icon: Icon, iconBg, iconColor, border, checkColor, highlight }) => {
          const features = t.raw(`${key}.features`) as string[];
          const isCurrentPlan = currentPlan === planKey;
          const isLowerPlan = PLAN_RANK[planKey] < PLAN_RANK[currentPlan];
          const isFree = planKey === "FREE";
          const isLoading = loading === planKey;

          // Button state
          const isDisabled = isFree || isCurrentPlan || isLowerPlan || isLoading;

          function getButtonLabel() {
            if (isCurrentPlan) return "Plan actuel";
            if (isLowerPlan) return "Plan inférieur";
            if (isLoading) return t("pro.cta");
            return t(`${key}.cta`);
          }

          return (
            <div
              key={key}
              className={cn(
                "relative rounded-2xl border-2 bg-card p-6 flex flex-col",
                border,
                highlight && "shadow-lg shadow-violet-500/10",
                isCurrentPlan && "ring-2 ring-primary/40",
              )}
            >
              {/* Most popular badge */}
              {highlight && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                    {t("mostPopular")}
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Plan actuel
                  </span>
                </div>
              )}

              <div className="mb-4">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-3", iconBg)}>
                  <Icon className={cn("h-5 w-5", iconColor)} />
                </div>
                <h2 className="text-xl font-bold">{t(`${key}.name`)}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t(`${key}.desc`)}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold">{t(`${key}.price`)}</span>
                <span className="text-sm text-muted-foreground ml-1">{t(`${key}.period`)}</span>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className={cn("h-4 w-4 shrink-0", checkColor)} />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={isCurrentPlan || isLowerPlan ? "outline" : "default"}
                className={cn(
                  "w-full",
                  !isDisabled && key === "pro" && "bg-violet-600 hover:bg-violet-700 text-white",
                  !isDisabled && key === "enterprise" && "bg-amber-600 hover:bg-amber-700 text-white",
                  isCurrentPlan && "opacity-60 cursor-not-allowed",
                  isLowerPlan && "opacity-40 cursor-not-allowed",
                )}
                disabled={isDisabled}
                onClick={() => {
                  if (!isFree && !isCurrentPlan && !isLowerPlan) {
                    handleUpgrade(planKey as "PRO" | "ENTERPRISE");
                  }
                }}
              >
                {isLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("pro.cta")}</>
                  : getButtonLabel()
                }
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("stripeNote")}</p>
    </div>
  );
}