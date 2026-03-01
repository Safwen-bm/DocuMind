import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  nom: string
  email: string
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  pendingEmail: string | null
  setAuth: (user: User, token: string) => void
  setPendingEmail: (email: string) => void
  logout: () => void
}

function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pendingEmail: null,

      setAuth: (user, token) => {
        localStorage.setItem('access_token', token)
        setCookie('access_token', token)
        set({ user, token, isAuthenticated: true })
      },

      setPendingEmail: (email) => set({ pendingEmail: email }),

      logout: () => {
        localStorage.removeItem('access_token')
        deleteCookie('access_token')
        set({ user: null, token: null, isAuthenticated: false, pendingEmail: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)