// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(auth)\reset-password\page.tsx

"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Brain, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string
  const token = searchParams.get("token")
  const tErr = useTranslations("auth.errors")

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirm = formData.get("confirm") as string

    if (password !== confirm) {
      setError(tErr("passwordMismatch"))
      setLoading(false)
      return
    }

    try {
      await api.post("/auth/reset-password", {
        token,
        nouveauMotDePasse: password,
      })
      setDone(true)
    } catch {
      setError("Link is invalid or expired.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground">Invalid reset link.</p>
          <Button className="mt-4" asChild>
            <Link href={`/${locale}/forgot-password`}>Request new link</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been reset successfully.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push(`/${locale}/login`)}>
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href={`/${locale}`} className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">DocuMind</span>
        </Link>

        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your new password below.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input id="password" name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters" required
                autoComplete="new-password" className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" name="confirm" type="password"
              placeholder="Repeat your password" required autoComplete="new-password" />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </div>
    </div>
  )
}