"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, FileText, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { notificationApi } from "@/lib/notification.api";
import { Notification, NotificationType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function getNotifIcon(type: NotificationType) {
  switch (type) {
    case "INVITATION":
      return Users;
    case "DOCUMENT_PARTAGE":
      return FileText;
    case "MEMBRE_REJOINT":
      return Users;
    default:
      return Info;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: notificationApi.getUnreadCount,
    refetchInterval: 30000, // poll every 30s
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: notificationApi.getAll,
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-semibold text-red-500">
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
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No notifications yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const Icon = getNotifIcon(notif.type);
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer",
                      !notif.lu && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!notif.lu) markReadMutation.mutate(notif.id);
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        !notif.lu ? "bg-primary/10" : "bg-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          !notif.lu ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          !notif.lu
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {notif.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.dateCreation), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notif.lu && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
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
