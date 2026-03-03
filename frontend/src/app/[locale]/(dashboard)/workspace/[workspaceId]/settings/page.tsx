"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { workspaceApi } from "@/lib/workspace.api";
import { Workspace } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string;
  const router = useRouter();
  const t = useTranslations("dashboard");
  const queryClient = useQueryClient();

  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId),
  });

  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  useEffect(() => {
    if (workspace) {
      setNom(workspace.nom);
      setDescription(workspace.description ?? "");
    }
  }, [workspace]);

  const updateMutation = useMutation({
    mutationFn: () =>
      workspaceApi.update(workspaceId, {
        nom,
        description: description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => workspaceApi.delete(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push(`/${locale}/dashboard`);
    },
  });

  const canDelete = deleteConfirm === workspace?.nom;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("workspace.settings.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("workspace.settings.subtitle")}
        </p>
      </div>

      {/* General settings */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">
          {t("workspace.settings.general")}
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("workspace.settings.name")}</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("workspace.settings.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || saved}
              className="gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved
                ? t("workspace.settings.saved")
                : t("workspace.settings.save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-6 rounded-xl border border-destructive/30 bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-base font-semibold text-destructive">
            {t("workspace.settings.dangerZone")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("workspace.settings.deleteDesc")}
        </p>

        {!showDeleteZone ? (
          <Button
            variant="outline"
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
            onClick={() => setShowDeleteZone(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("workspace.settings.deleteButton")}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {t("workspace.settings.confirmDelete")}:{" "}
              <strong>{workspace?.nom}</strong>
            </p>
            <Input
              placeholder={workspace?.nom}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="border-destructive/30 focus:border-destructive"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteZone(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="gap-2"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("workspace.settings.confirmDeleteButton")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
