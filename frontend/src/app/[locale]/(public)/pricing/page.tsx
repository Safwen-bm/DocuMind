// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\pricing\page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace.api";
import { plansApi } from "@/lib/plans.api";
import { Button } from "@/components/ui/button";
import { Check, Zap, Sparkles, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Workspace } from "@/lib/types";

export default function PricingPage() {
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const t = useTranslations("dashboard.plans.pricing");
  const [loading, setLoading] = useState<string | null>(null);

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
  });

  const ownedWorkspace = workspaces?.find((w) => w.isOwner);

  async function handleUpgrade(planKey: "PRO" | "ENTERPRISE") {
    if (!ownedWorkspace) { toast.error(t("noWorkspaceError")); return; }
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
    { key: "free",       icon: FolderOpen, iconBg: "bg-muted",          iconColor: "text-muted-foreground", border: "border-border",          checkColor: "text-primary",    btnVariant: "outline" as const,  highlight: false },
    { key: "pro",        icon: Zap,        iconBg: "bg-violet-500/10",   iconColor: "text-violet-500",       border: "border-violet-500/40",   checkColor: "text-violet-500", btnVariant: "default" as const,  highlight: true  },
    { key: "enterprise", icon: Sparkles,   iconBg: "bg-amber-500/10",    iconColor: "text-amber-500",        border: "border-amber-500/40",    checkColor: "text-amber-500",  btnVariant: "default" as const,  highlight: false },
  ];

  return (
    <div className="mx-auto max-w-5xl py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map(({ key, icon: Icon, iconBg, iconColor, border, checkColor, btnVariant, highlight }) => {
          const isFree = key === "free";
          const isLoading = loading === key.toUpperCase();
          const features = t.raw(`${key}.features`) as string[];

          return (
            <div key={key} className={cn("relative rounded-2xl border-2 bg-card p-6 flex flex-col", border, highlight && "shadow-lg shadow-violet-500/10")}>
              {highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">{t("mostPopular")}</span>
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
                variant={btnVariant}
                className={cn("w-full",
                  key === "pro" && "bg-violet-600 hover:bg-violet-700 text-white",
                  key === "enterprise" && "bg-amber-600 hover:bg-amber-700 text-white",
                )}
                disabled={isFree || isLoading}
                onClick={() => !isFree && handleUpgrade(key.toUpperCase() as "PRO" | "ENTERPRISE")}
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("pro.cta")}</> : t(`${key}.cta`)}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("stripeNote")}</p>
    </div>
  );
}