"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

export function useAuthHydration() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user) return;

    // Safer cookie read — handles '=' in JWT values
    const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
    const token = match ? decodeURIComponent(match[1]) : null;

    if (!token) return;

    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.id) setAuth(res.data);
      })
      .catch(async (err) => {
        if (err.response?.status === 401) {
          document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
          await logout();
          const locale = pathname.split("/")[1] || "en";
          router.replace(`/${locale}/login`);
        }
      });
  }, []);
}