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

    // Read the token from the frontend cookie
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1];

    // No token at all — not logged in, let middleware handle it
    if (!token) return;

    // Call /auth/me with Bearer token (works cross-domain)
    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data?.id) setAuth(res.data);
      })
      .catch(async (err) => {
        if (err.response?.status === 401) {
          // Token is invalid/expired — clear everything
          document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
          await logout();
          const locale = pathname.split("/")[1] || "en";
          router.replace(`/${locale}/login`);
        }
        // Network error or 500 — stay put, don't kick user out
      });
  }, []);
}