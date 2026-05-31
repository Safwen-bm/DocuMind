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
    if (user) return; // already hydrated, skip

    api
      .get("/auth/me")
      .then((res) => {
        if (res.data?.id) setAuth(res.data);
      })
      .catch(async (err) => {
        if (err.response?.status === 401) {
          // Cookie exists but user doesn't — stale token after DB reset
          // Clear everything and redirect to login
          await logout();

          // Extract locale from the current path: /en/dashboard → en
          const locale = pathname.split("/")[1] || "en";
          router.replace(`/${locale}/login`);
        }
        // Any other error (network, 500) — do nothing, stay put
      });
  }, []);
}