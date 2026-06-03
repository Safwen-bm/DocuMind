// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\store\auth.store.ts

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
  pendingEmail: string | null;
  justLoggedIn: boolean;
  setAuth: (user: User) => void;
  setPendingEmail: (email: string) => void;
  logout: () => void;
  setJustLoggedIn: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  pendingEmail: null,
  justLoggedIn: false,

  setAuth: (user) => {
    // No localStorage, no manual cookie — backend set the httpOnly cookie
    set({ user, isAuthenticated: true });
  },

  setPendingEmail: (email) => set({ pendingEmail: email }),

  setJustLoggedIn: (val) => set({ justLoggedIn: val }),

  logout: async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    // Clear the frontend cookie too
    if (typeof window !== 'undefined') {
      document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax'
    }
    set({ user: null, isAuthenticated: false, pendingEmail: null });
  },
}));
