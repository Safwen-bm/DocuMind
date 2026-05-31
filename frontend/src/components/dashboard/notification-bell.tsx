"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  CheckCheck,
  FileText,
  Users,
  Info,
  MessageSquare,
  FilePlus,
  FileEdit,
  UserX,
  ShieldCheck,
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { notificationApi } from "@/lib/notification.api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr, ar, enUS } from "date-fns/locale";

type NotificationType =
  | "INVITATION"
  | "MENTION"
  | "DOCUMENT_PARTAGE"
  | "MEMBRE_REJOINT"
  | "COMMENTAIRE"
  | "NOUVEAU_DOCUMENT"
  | "DOCUMENT_MODIFIE"
  | "ROLE_MODIFIE"
  | "MEMBRE_RETIRE"
  | "SYSTEME";

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  lu: boolean;
  lien: string | null;
  dateCreation: string;
  workspaceId: string | null;
}

function getNotifStyle(type: NotificationType) {
  switch (type) {
    case "INVITATION":
      return { Icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" };
    case "MEMBRE_REJOINT":
      return { Icon: Users, color: "text-green-500", bg: "bg-green-500/10" };
    case "MENTION":
      return { Icon: AtSign, color: "text-violet-500", bg: "bg-violet-500/10" };
    case "COMMENTAIRE":
      return { Icon: MessageSquare, color: "text-orange-500", bg: "bg-orange-500/10" };
    case "NOUVEAU_DOCUMENT":
      return { Icon: FilePlus, color: "text-primary", bg: "bg-primary/10" };
    case "DOCUMENT_MODIFIE":
      return { Icon: FileEdit, color: "text-amber-500", bg: "bg-amber-500/10" };
    case "DOCUMENT_PARTAGE":
      return { Icon: FileText, color: "text-cyan-500", bg: "bg-cyan-500/10" };
    case "ROLE_MODIFIE":
      return { Icon: ShieldCheck, color: "text-indigo-500", bg: "bg-indigo-500/10" };
    case "MEMBRE_RETIRE":
      return { Icon: UserX, color: "text-red-500", bg: "bg-red-500/10" };
    default:
      return { Icon: Info, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

function getDateLocale(locale: string) {
  if (locale === "fr") return fr;
  if (locale === "ar") return ar;
  return enUS;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("dashboard.notifications");
  const dateLocale = getDateLocale(locale);

  // ── Count: NO polling interval — socket updates this cache directly ───────
  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: notificationApi.getUnreadCount,
    // Fetch once on mount for the initial value, then socket takes over
    staleTime: Infinity,
  });

  // ── Full list: fetch on open, socket prepends new items automatically ─────
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: notificationApi.getAll,
    enabled: open,
    // Keep the list fresh for 1 minute; re-fetches when popover re-opens
    staleTime: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const unreadCount = countData?.count ?? 0;

  function handleNotifClick(notif: Notification) {
    if (!notif.lu) markReadMutation.mutate(notif.id);
    if (notif.lien) {
      setOpen(false);
      router.push(`/${locale}${notif.lien}`);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {t("title")}
            </span>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/10 px-1 text-[11px] font-semibold text-red-500">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("markAllRead")}
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                <Bell className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("allCaughtUp")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("noNotifications")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const { Icon, color, bg } = getNotifStyle(notif.type);
                const isClickable = !!notif.lien;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      !notif.lu && "bg-primary/5",
                      isClickable
                        ? "cursor-pointer hover:bg-muted/50"
                        : "cursor-default",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
                        bg,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs leading-snug",
                          !notif.lu
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.dateCreation), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>

                    {!notif.lu && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}