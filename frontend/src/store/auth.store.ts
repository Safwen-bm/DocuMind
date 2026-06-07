// frontend/src/store/auth.store.ts

import { create } from "zustand";

interface User {
  id: string;
  nom: string;
  email: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;          // ← new
  pendingEmail: string | null;
  justLoggedIn: boolean;
  setAuth: (user: User) => void;
  setPendingEmail: (email: string) => void;
  logout: () => void;
  setJustLoggedIn: (val: boolean) => void;
  setHydrated: () => void;    // ← new
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,             // ← starts false
  pendingEmail: null,
  justLoggedIn: false,

  setAuth: (user) => {
    set({ user, isAuthenticated: true });
  },

  setPendingEmail: (email) => set({ pendingEmail: email }),

  setJustLoggedIn: (val) => set({ justLoggedIn: val }),

  setHydrated: () => set({ hydrated: true }),  // ← new

  logout: async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    }
    set({ user: null, isAuthenticated: false, pendingEmail: null, hydrated: true });
  },
}));