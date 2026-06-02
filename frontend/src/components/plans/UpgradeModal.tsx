// \frontend\src\components\plans\UpgradeModal.tsx

"use client";

import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePlansStore } from "@/store/plans.store";
import { plansApi } from "@/lib/plans.api";
import { PlanLimitCode } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Users, FileText, MessageSquare, FolderOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const limitIcons: Record<PlanLimitCode, any> = {
  PLAN_LIMIT_WORKSPACES: FolderOpen,
  PLAN_LIMIT_MEMBERS: Users,
  PLAN_LIMIT_DOCUMENTS: FileText,
  PLAN_LIMIT_AI: MessageSquare,
};

export function UpgradeModal() {
  const { upgradeModal, closeUpgradeModal } = usePlansStore();
  const { open, code, currentPlan, workspaceId } = upgradeModal;
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();
  const t = useTranslations("dashboard.plans.upgrade");
  const [loading, setLoading] = useState<"PRO" | "ENTERPRISE" | null>(null);

  const Icon = code ? limitIcons[code] : Zap;

  async function handleUpgrade(plan: "PRO" | "ENTERPRISE") {
    const wsId = workspaceId ?? (params?.workspaceId as string);
    if (!wsId) {
      closeUpgradeModal();
      router.push(`/${locale}/pricing`);
      return;
    }
    try {
      setLoading(plan);
      const { url } = await plansApi.createCheckout(wsId, plan);
      window.location.href = url;
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeUpgradeModal}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 mb-3">
            <Icon className="h-6 w-6 text-violet-500" />
          </div>
          <DialogTitle className="text-xl">
            {code ? t(`limits.${code}.title`) : t("title")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {code ? t(`limits.${code}.desc`) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-violet-500" />
              <span className="font-semibold text-foreground">{t("pro.name")}</span>
              <span className="ml-auto text-sm font-bold text-foreground">{t("pro.price")}</span>
            </div>
            <ul className="space-y-1.5 mb-4">
              {(t.raw("pro.features") as string[]).map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              size="sm"
              disabled={!!loading || currentPlan === "PRO"}
              onClick={() => handleUpgrade("PRO")}
            >
              {loading === "PRO" ? t("redirecting") : currentPlan === "PRO" ? t("currentPlan") : t("pro.cta")}
            </Button>
          </div>

          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-foreground">{t("enterprise.name")}</span>
              <span className="ml-auto text-sm font-bold text-foreground">{t("enterprise.price")}</span>
            </div>
            <ul className="space-y-1.5 mb-4">
              {(t.raw("enterprise.features") as string[]).map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              size="sm"
              disabled={!!loading || currentPlan === "ENTERPRISE"}
              onClick={() => handleUpgrade("ENTERPRISE")}
            >
              {loading === "ENTERPRISE" ? t("redirecting") : currentPlan === "ENTERPRISE" ? t("currentPlan") : t("enterprise.cta")}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => { closeUpgradeModal(); router.push(`/${locale}/pricing`); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {t("viewPricing")}
          </button>
          <Button variant="ghost" size="sm" onClick={closeUpgradeModal}>
            {t("maybeLater")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}