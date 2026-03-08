//C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\components\dashboard\dashboard-sidebar.tsx

"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Brain,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  ChevronRight,
  User,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { workspaceApi } from "@/lib/workspace.api";
import { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export function DashboardSidebar({
  collapsed,
  onToggleCollapse,
  onClose,
}: DashboardSidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params.locale as string;
  const workspaceId = params.workspaceId as string | undefined;
  const { user, logout } = useAuthStore();
  const t = useTranslations("dashboard.nav");
  const tProfile = useTranslations("profile");

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
  });

  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId);

  const initials = user?.nom
    ? user.nom
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  function handleLogout() {
    logout();
    router.push(`/${locale}/login`);
  }

  function handleProfileClick() {
    router.push(`/${locale}/profile`);
    onClose?.();
  }

  const workspaceNav = workspaceId
    ? [
        {
          href: `/${locale}/workspace/${workspaceId}`,
          icon: LayoutDashboard,
          label: t("overview"),
        },
        {
          href: `/${locale}/workspace/${workspaceId}/documents`,
          icon: FileText,
          label: t("documentsNav"),
        },
        {
          href: `/${locale}/workspace/${workspaceId}/ai`,
          icon: Sparkles,
          label: t("aiAssistant"),
          highlight: true, // special styling for AI item
        },
        {
          href: `/${locale}/workspace/${workspaceId}/members`,
          icon: Users,
          label: t("members"),
        },
        {
          href: `/${locale}/workspace/${workspaceId}/settings`,
          icon: Settings,
          label: t("settings"),
        },
      ]
    : [];

  function NavItem({
    href,
    icon: Icon,
    label,
    active,
    highlight,
    onClick,
  }: {
    href?: string;
    icon: React.ElementType;
    label: string;
    active: boolean;
    highlight?: boolean;
    onClick?: () => void;
  }) {
    const content = (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
          collapsed ? "justify-center px-0 w-10 h-10 mx-auto" : "",
          active
            ? "bg-primary/10 text-primary"
            : highlight
              ? "text-primary/70 hover:bg-primary/8 hover:text-primary"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            highlight && !active && "text-primary/60",
          )}
        />
        {!collapsed && <span>{label}</span>}
        {/* AI badge — small dot indicator when not collapsed */}
        {!collapsed && highlight && !active && (
          <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-primary/60" />
        )}
      </div>
    );

    const wrapped = collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link href={href} onClick={onClose}>
              {content}
            </Link>
          ) : (
            <button onClick={onClick}>{content}</button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    ) : href ? (
      <Link href={href} onClick={onClose}>
        {content}
      </Link>
    ) : (
      <button onClick={onClick} className="w-full">
        {content}
      </button>
    );

    return wrapped;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Logo + collapse button */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-3",
            collapsed ? "justify-center" : "justify-between px-5",
          )}
        >
          {!collapsed && (
            <Link
              href={`/${locale}/dashboard`}
              className="flex items-center gap-2.5"
              onClick={onClose}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold">DocuMind</span>
            </Link>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/${locale}/dashboard`}
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
                >
                  <Brain className="h-4 w-4 text-primary-foreground" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>DocuMind</p>
              </TooltipContent>
            </Tooltip>
          )}

          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Collapse sidebar</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="flex justify-center pt-3 pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Expand sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-3 space-y-1">
          {/* Dashboard link */}
          <div className={cn("px-3", collapsed && "px-2")}>
            <NavItem
              href={`/${locale}/dashboard`}
              icon={LayoutDashboard}
              label={t("dashboard")}
              active={pathname === `/${locale}/dashboard`}
            />
          </div>

          {/* Current workspace section */}
          {currentWorkspace && (
            <div className={cn("pt-4", collapsed ? "px-2" : "px-3")}>
              {!collapsed && (
                <>
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("currentWorkspace")}
                  </p>
                  <div className="mb-1 flex items-center gap-2.5 rounded-lg bg-sidebar-accent px-3 py-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                      {currentWorkspace.nom[0].toUpperCase()}
                    </div>
                    <span className="truncate text-sm font-semibold text-sidebar-foreground">
                      {currentWorkspace.nom}
                    </span>
                  </div>
                </>
              )}

              {collapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary/10 mb-2 cursor-default">
                      <span className="text-xs font-bold text-primary">
                        {currentWorkspace.nom[0].toUpperCase()}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{currentWorkspace.nom}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <div className={cn("space-y-0.5", !collapsed && "pl-2")}>
                {workspaceNav.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={pathname === item.href}
                    highlight={item.highlight}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Workspaces list */}
          {workspaces && workspaces.length > 0 && (
            <div className={cn("pt-4", collapsed ? "px-2" : "px-3")}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("workspaces")}
                </p>
              )}
              {collapsed && (
                <div className="my-2 h-px bg-sidebar-border mx-2" />
              )}
              <div className="space-y-0.5">
                {workspaces.map((ws) =>
                  collapsed ? (
                    <Tooltip key={ws.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/${locale}/workspace/${ws.id}`}
                          onClick={onClose}
                          className={cn(
                            "flex h-10 w-10 mx-auto items-center justify-center rounded-lg text-[11px] font-bold transition-colors",
                            workspaceId === ws.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-sidebar-accent text-sidebar-foreground hover:bg-primary/10 hover:text-primary",
                          )}
                        >
                          {ws.nom[0].toUpperCase()}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{ws.nom}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      key={ws.id}
                      href={`/${locale}/workspace/${ws.id}`}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        workspaceId === ws.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                          workspaceId === ws.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-sidebar-accent text-sidebar-foreground",
                        )}
                      >
                        {ws.nom[0].toUpperCase()}
                      </div>
                      <span className="truncate">{ws.nom}</span>
                      {workspaceId === ws.id && (
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                      )}
                    </Link>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3">
          {collapsed ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors">
                      <Avatar className="h-7 w-7">
                        {user?.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user.nom} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{user?.nom}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                side="right"
                align="end"
                className="w-56 mb-1"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {user?.nom}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleProfileClick}
                  className="gap-2 cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  {tProfile("title")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  {tProfile("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
                  <Avatar className="h-8 w-8 shrink-0">
                    {user?.avatarUrl && (
                      <AvatarImage src={user.avatarUrl} alt={user.nom} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {user?.nom}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56 mb-1"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {user?.nom}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleProfileClick}
                  className="gap-2 cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  {tProfile("title")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  {tProfile("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
