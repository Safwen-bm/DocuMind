"use client";

// frontend/src/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/_components/NewDocumentModal.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentApi } from "@/lib/document.api";
import { DOCUMENT_TEMPLATES, DocumentTemplate } from "@/lib/document-templates";
import { cn } from "@/lib/utils";
import { X, Plus, Wand2, FileText, ChevronRight, Info } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface NewDocumentModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  dossierId?: string | null;
  dossierName?: string | null;
  onOpenGenerate: (prefillDescription: string) => void;
}

type Tab = "blank" | "templates" | "ai";

export function NewDocumentModal({
  open,
  onClose,
  workspaceId,
  dossierId,
  dossierName,
  onOpenGenerate,
}: NewDocumentModalProps) {
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const t = useTranslations("dashboard.templates");
  const tDocs = useTranslations("dashboard.documents");

  const [tab, setTab] = useState<Tab>("templates");
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  // Name field shown on every tab
  const [docName, setDocName] = useState("");

  // Location label for UI copy
  const locationLabel = dossierName ? `dans "${dossierName}"` : "à la racine du workspace";

  function resolvedName(fallback: string) {
    return docName.trim() || fallback;
  }

  // ── Create blank document ─────────────────────────────────────────────────
  const createBlankMutation = useMutation({
    mutationFn: () =>
      documentApi.create(workspaceId, {
        titre: resolvedName(tDocs("createDocModal.placeholder")),
        dossierId: dossierId ?? undefined,
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] });
      // Show info toast if the name was auto-renamed (server resolved duplicate)
      if (doc.titre !== resolvedName(tDocs("createDocModal.placeholder"))) {
        toast.info(`Renommé en "${doc.titre}" car un fichier avec ce nom existait déjà.`);
      }
      handleClose();
      router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`);
    },
    onError: () => {
      toast.error("Impossible de créer le document. Réessayez.");
    },
  });

  // ── Create from template ──────────────────────────────────────────────────
  async function handleTemplateClick(template: DocumentTemplate) {
    if (loadingTemplateId) return;
    setLoadingTemplateId(template.id);
    try {
      const templateTitle = resolvedName(t(`${template.titleKey}`));
      const doc = await documentApi.create(workspaceId, {
        titre: templateTitle,
        dossierId: dossierId ?? undefined,
      });
      // Apply template content silently — updateSilent never throws 409
      await documentApi.updateSilent(doc.id, { contenu: template.content });
      queryClient.invalidateQueries({ queryKey: ["docs", workspaceId] });
      if (doc.titre !== templateTitle) {
        toast.info(`Renommé en "${doc.titre}" car un fichier avec ce nom existait déjà.`);
      }
      handleClose();
      router.push(`/${locale}/workspace/${workspaceId}/documents/${doc.id}`);
    } catch {
      toast.error("Impossible de créer le document. Réessayez.");
    } finally {
      setLoadingTemplateId(null);
    }
  }

  function handleAiTemplateClick(template: DocumentTemplate) {
    onClose();
    onOpenGenerate(t(`${template.aiPromptKey}`));
  }

  function handleClose() {
    setDocName("");
    onClose();
  }

  if (!open) return null;

  // ── Name field — shown on all tabs ────────────────────────────────────────
  const NameField = (
    <div className="px-6 pt-4 pb-2">
      <label className="mb-1.5 block text-xs font-semibold text-foreground">
        Nom du document
        <span className="ml-1 font-normal text-muted-foreground">(optionnel)</span>
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tab === "blank") createBlankMutation.mutate();
          }}
          placeholder={
            tab === "blank"
              ? tDocs("createDocModal.placeholder")
              : tab === "templates"
              ? "Laisser vide pour utiliser le nom du modèle"
              : "Nom du document généré"
          }
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" />
        Si ce nom existe déjà {locationLabel}, il sera automatiquement renommé ex: nom (1)
      </p>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("modalTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dossierName ? `${t("modalSubtitle")} — ${locationLabel}` : t("modalSubtitle")}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border px-6 pt-3">
            {(["templates", "ai", "blank"] as Tab[]).map((tabId) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={cn(
                  "pb-3 px-3 text-xs font-semibold transition-colors border-b-2 -mb-px",
                  tab === tabId
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tab.${tabId}`)}
              </button>
            ))}
          </div>

          {/* Name field on every tab */}
          {NameField}

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto px-6 pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">

            {/* Blank tab */}
            {tab === "blank" && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("blank.title")}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t("blank.desc")}</p>
                </div>
                <button
                  onClick={() => createBlankMutation.mutate()}
                  disabled={createBlankMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {createBlankMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Plus className="h-4 w-4" />}
                  {t("blank.cta")}
                </button>
              </div>
            )}

            {/* Templates tab */}
            {tab === "templates" && (
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                {DOCUMENT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isLoading = loadingTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      disabled={!!loadingTemplateId}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 disabled:opacity-60",
                        isLoading && "border-primary/40 bg-primary/5",
                      )}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", template.color)}>
                        {isLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {t(`${template.titleKey}`)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {t(`${template.descKey}`)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* AI tab */}
            {tab === "ai" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                  <Wand2 className="h-4 w-4 text-violet-500 shrink-0" />
                  <p className="text-xs text-violet-600 dark:text-violet-400">{t("aiTabHint")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DOCUMENT_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleAiTemplateClick(template)}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-violet-500/40 hover:shadow-md hover:shadow-violet-500/5"
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", template.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground group-hover:text-violet-500 transition-colors">
                            {t(`${template.titleKey}`)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {t(`${template.descKey}`)}
                          </p>
                        </div>
                        <div className="shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1">
                            <Wand2 className="h-3 w-3 text-violet-500" />
                            <span className="text-[10px] font-semibold text-violet-500">AI</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}