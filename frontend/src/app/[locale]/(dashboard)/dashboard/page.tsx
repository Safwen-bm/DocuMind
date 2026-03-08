"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth.store";
import { workspaceApi } from "@/lib/workspace.api";
import { documentApi } from "@/lib/document.api";
import { activiteApi } from "@/lib/activite.api";
import { Workspace, Document, Activite, DocumentStats } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  FolderOpen,
  Users,
  ArrowRight,
  Loader2,
  FileText,
  Star,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr, ar, enUS } from "date-fns/locale";

const roleColors: Record<string, string> = {
  PROPRIETAIRE: "bg-primary/10 text-primary",
  ADMINISTRATEUR: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  EDITEUR: "bg-green-500/10 text-green-600 dark:text-green-400",
  LECTEUR: "bg-muted text-muted-foreground",
};

export default function DashboardPage() {
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, justLoggedIn, setJustLoggedIn } = useAuthStore();

  useEffect(() => {
    if (justLoggedIn) {
      setJustLoggedIn(false);
      toast.success(t("welcomeBack", { name: user?.nom?.split(" ")[0] ?? "" }));
    }
  }, []);

  const currentLocale = useLocale();
  const t = useTranslations("dashboard.home");
  const tRoles = useTranslations("dashboard.workspace.roles");

  const dateFnsLocale =
    currentLocale === "fr" ? fr : currentLocale === "ar" ? ar : enUS;

  const [createOpen, setCreateOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const { data: workspaces, isLoading: wsLoading } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
  });

  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ["doc-stats"],
    queryFn: documentApi.getStats,
  });

  const { data: recentDocs } = useQuery<Document[]>({
    queryKey: ["recent-docs"],
    queryFn: documentApi.getRecent,
  });

  const { data: favoriDocs } = useQuery<Document[]>({
    queryKey: ["favori-docs"],
    queryFn: documentApi.getFavoris,
  });

  const firstWorkspaceId = workspaces?.[0]?.id;
  const { data: activity } = useQuery<Activite[]>({
    queryKey: ["activity", firstWorkspaceId],
    queryFn: () => activiteApi.getByWorkspace(firstWorkspaceId!),
    enabled: !!firstWorkspaceId,
  });

  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCreateOpen(false);
      setNom("");
      setDescription("");
      router.push(`/${locale}/workspace/${workspace.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Something went wrong.");
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setError("");
    createMutation.mutate({
      nom: nom.trim(),
      description: description.trim() || undefined,
    });
  }

  const totalMembers =
    workspaces?.reduce((acc, ws) => acc + ws._count.membres, 0) ?? 0;
  const firstName = user?.nom?.split(" ")[0] ?? "";

  const statCards = [
    {
      label: t("stats.workspaces"),
      value: workspaces?.length ?? 0,
      icon: FolderOpen,
      color: "text-primary bg-primary/10",
      loading: wsLoading,
    },
    {
      label: t("stats.documents"),
      value: stats?.totalDocuments ?? 0,
      icon: FileText,
      color: "text-blue-500 bg-blue-500/10",
      loading: !stats,
    },
    {
      label: t("stats.members"),
      value: totalMembers,
      icon: Users,
      color: "text-green-500 bg-green-500/10",
      loading: wsLoading,
    },
    {
      label: t("stats.starred"),
      value: stats?.totalFavoris ?? 0,
      icon: Star,
      color: "text-yellow-500 bg-yellow-500/10",
      loading: !stats,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("welcomeBack", { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("activitySubtitle")}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 hidden sm:flex"
        >
          <Plus className="h-4 w-4" />
          {t("newWorkspace")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div
              className={cn(
                "mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                stat.color,
              )}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            {stat.loading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Starred */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold text-foreground">{t("starred")}</h3>
            </div>
          </div>
          <div className="divide-y divide-border">
            {!favoriDocs ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))
            ) : favoriDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Star className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("noStarred")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("noStarredDesc")}
                </p>
              </div>
            ) : (
              favoriDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() =>
                    router.push(
                      `/${locale}/workspace/${doc.workspaceId}/documents/${doc.id}`,
                    )
                  }
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                    <FileText className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {doc.titre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doc.workspace?.nom} ·{" "}
                      {formatDistanceToNow(new Date(doc.dateMiseAJour), {
                        addSuffix: true,
                        locale: dateFnsLocale,
                      })}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">
              {t("recentActivity")}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {!activity ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1 pt-1">
                    <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("noActivity")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("noActivityDesc")}
                </p>
              </div>
            ) : (
              activity.slice(0, 6).map((item) => {
                const initials = item.user.nom
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      {item.user.avatarUrl && (
                        <AvatarImage
                          src={item.user.avatarUrl}
                          alt={item.user.nom}
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{item.user.nom}</span>{" "}
                        <span className="text-muted-foreground">
                          {t(`actions.${item.action}`, {
                            defaultValue: item.action,
                          })}
                        </span>{" "}
                        <span className="font-medium">{item.cible}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.dateCreation), {
                          addSuffix: true,
                          locale: dateFnsLocale,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recently Edited */}
      {recentDocs && recentDocs.length > 0 && (
        <div>
          <h3 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t("recentlyEdited")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() =>
                  router.push(
                    `/${locale}/workspace/${doc.workspaceId}/documents/${doc.id}`,
                  )
                }
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {doc.titre}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.workspace?.nom} ·{" "}
                    {formatDistanceToNow(new Date(doc.dateMiseAJour), {
                      addSuffix: true,
                      locale: dateFnsLocale,
                    })}
                  </p>
                </div>
                {doc.estFavori && (
                  <Star className="h-3.5 w-3.5 shrink-0 text-yellow-500 fill-yellow-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My Workspaces */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{t("myWorkspaces")}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("new")}
          </Button>
        </div>

        {wsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : workspaces && workspaces.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => router.push(`/${locale}/workspace/${ws.id}`)}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {ws.nom[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                      {ws.nom}
                    </p>
                    <span
                      className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-md",
                        roleColors[ws.monRole],
                      )}
                    >
                      {tRoles(ws.monRole)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                {ws.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                    {ws.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                  <Users className="h-3.5 w-3.5" />
                  <span>{t("membersCount", { count: ws._count.membres })}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">
              {t("noWorkspaces")}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {t("noWorkspacesDesc")}
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-5 gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              {t("newWorkspace")}
            </Button>
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("modal.title")}</DialogTitle>
            <DialogDescription>{t("modal.subtitle")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">{t("modal.nameLabel")}</Label>
              <Input
                id="nom"
                placeholder={t("modal.namePlaceholder")}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("modal.descLabel")}</Label>
              <Textarea
                id="description"
                placeholder={t("modal.descPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {t("modal.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("modal.submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
