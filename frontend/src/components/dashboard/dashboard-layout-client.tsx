"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KeyboardShortcutsModal } from "@/components/dashboard/KeyboardShortcutsModal";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationsSocket } from "@/hooks/useNotifications";

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  useAuthHydration();

  const { isAuthenticated } = useAuthStore();

  // ── Real-time notifications — one socket for the entire dashboard ─────────
  // Starts as soon as the user is authenticated, lives for the whole session
  useNotificationsSocket({ enabled: isAuthenticated });

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (!isTyping && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className="hidden lg:block shrink-0 transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? 64 : 256 }}
      >
        <DashboardSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border shadow-xl">
            <DashboardSidebar
              collapsed={false}
              onToggleCollapse={() => {}}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setMobileOpen((prev) => !prev)} />
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}