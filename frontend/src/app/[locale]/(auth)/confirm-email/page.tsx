// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(auth)\confirm-email\page.tsx

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Brain, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth.store"

export default function ConfirmEmailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string
  const token = searchParams.get("token")
  const pendingEmail = useAuthStore((s) => s.pendingEmail)

  const [status, setStatus] = useState<"loading" | "success" | "error" | "waiting">(
    token ? "loading" : "waiting"
  )

  useEffect(() => {
    if (!token) return
    api.get(`/auth/confirm-email?token=${token}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"))
  }, [token])

  if (status === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link href={`/${locale}`} className="mb-8 inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">DocuMind</span>
          </Link>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{pendingEmail}</span>.
            Click the link in the email to activate your account.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn't receive it? Check your spam folder.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href={`/${locale}/login`}>Back to login</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Account activated!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is now active. You can sign in.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push(`/${locale}/login`)}>
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This confirmation link is invalid or has expired.
        </p>
        <Button variant="outline" className="mt-6 w-full" asChild>
          <Link href={`/${locale}/login`}>Back to login</Link>
        </Button>
      </div>
    </div>
  )
}