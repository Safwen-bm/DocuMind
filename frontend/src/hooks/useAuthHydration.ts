// frontend/src/hooks/useAuthHydration.ts

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

export function useAuthHydration() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setHydrated = useAuthStore((state) => state.setHydrated); // ← new
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Already hydrated from a previous run in this tab — skip
    if (user) {
      setHydrated(); // ← still mark it done in case this is a re-render
      return;
    }

    const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
    const token = match ? decodeURIComponent(match[1]) : null;

    if (!token) {
      // No cookie — user is definitely not logged in, mark hydration done
      setHydrated(); // ← this was the missing line causing infinite spinner
      return;
    }

    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.id) setAuth(res.data);
      })
      .catch(async (err) => {
        if (err.response?.status === 401) {
          document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
          await logout();
          const locale = pathname.split("/")[1] || "en";
          router.replace(`/${locale}/login`);
        }
      })
      .finally(() => {
        setHydrated(); // ← called after success or error, covers both cases
      });
  }, []);
}