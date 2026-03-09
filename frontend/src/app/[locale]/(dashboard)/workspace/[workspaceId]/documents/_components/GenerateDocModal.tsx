"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { aiApi } from "@/lib/ai.api";
import { cn } from "@/lib/utils";
import {
  X,
  Wand2,
  Loader2,
  FileText,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface GenerateDocModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** Optional — if user is inside a folder when they click Generate */
  dossierId?: string;
  /** Called after doc is created so the parent can refetch the list */
  onCreated?: (documentId: string) => void;
}

const EXAMPLES = [
  "generate.example1",
  "generate.example2",
  "generate.example3",
  "generate.example4",
] as const;

export function GenerateDocModal({
  open,
  onClose,
  workspaceId,
  dossierId,
  onCreated,
}: GenerateDocModalProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const locale = useLocale();

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "generating">("form");

  function handleClose() {
    if (loading) return;
    setTitre("");
    setDescription("");
    setStep("form");
    onClose();
  }

  async function handleGenerate() {
    const t_titre = titre.trim();
    const t_desc = description.trim();
    if (!t_titre || !t_desc || loading) return;

    setLoading(true);
    setStep("generating");

    try {
      const result = await aiApi.generateDocument(
        workspaceId,
        t_titre,
        t_desc,
        dossierId,
      );
      toast.success(t("generate.successToast", { titre: t_titre }));
      onCreated?.(result.documentId);
      handleClose();
      // Navigate to the new document immediately
      router.push(
        `/${locale}/workspace/${workspaceId}/documents/${result.documentId}`,
      );
    } catch {
      toast.error(t("generate.errorToast"));
      setStep("form");
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-primary">
                <Wand2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("generate.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("generate.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {step === "generating" ? (
            /* ── Generating state ── */
            <div className="flex flex-col items-center justify-center gap-4 px-5 py-16">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-primary/20">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground p-0.5" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {t("generate.generating")}
                </p>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  {t("generate.generatingDesc")}
                </p>
              </div>
              {/* Animated progress dots */}
              <div className="flex items-center gap-1.5 mt-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <div className="p-5 space-y-4">
              {/* Title input */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  {t("generate.titreLabel")}
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    placeholder={t("generate.titrePlaceholder")}
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
              </div>

              {/* Description textarea */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  {t("generate.descLabel")}
                  <span className="text-destructive ml-0.5">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                      handleGenerate();
                  }}
                  placeholder={t("generate.descPlaceholder")}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t("generate.descHint")}
                </p>
              </div>

              {/* Example suggestions */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("generate.examples")}
                </p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLES.map((key) => (
                    <button
                      key={key}
                      onClick={() => setDescription(t(key))}
                      className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                    >
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{t(key)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {step === "form" && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <button
                onClick={handleClose}
                className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {t("documents.createDocModal.cancel")}
              </button>
              <button
                onClick={handleGenerate}
                disabled={!titre.trim() || !description.trim()}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all",
                  titre.trim() && description.trim()
                    ? "bg-gradient-to-r from-violet-500 to-primary text-white hover:from-violet-600 hover:to-primary/90 shadow-sm"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                )}
              >
                <Wand2 className="h-4 w-4" />
                {t("generate.submit")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
