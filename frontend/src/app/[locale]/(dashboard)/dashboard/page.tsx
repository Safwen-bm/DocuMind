"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuthStore } from "@/store/auth.store"
import { Button } from "@/components/ui/button"
import { Brain, LogOut } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const { user, isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/${locale}/login`)
    }
  }, [isAuthenticated])

  function handleLogout() {
    logout()
    router.push(`/${locale}/login`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">DocuMind</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome, {user?.nom} 👋</h1>
          <p className="mt-2 text-muted-foreground">
            Sprint 1 complete. Dashboard coming in Sprint 2.
          </p>
        </div>
      </main>
    </div>
  )
}