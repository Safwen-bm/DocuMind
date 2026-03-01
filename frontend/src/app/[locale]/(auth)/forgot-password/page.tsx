"use client"

import Link from "next/link"
import { useState } from "react"
import { useParams } from "next/navigation"
import { Brain, Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

export default function ForgotPasswordPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations("auth.forgotPassword")

  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    try {
      await api.post("/auth/forgot-password", { email })
    } finally {
      setSent(true)
      setLoading(false)
    }
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

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">{t("sent")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("sentSubtitle")}</p>
            <Button variant="outline" className="mt-6 gap-2" asChild>
              <Link href={`/${locale}/login`}>
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email"
                  placeholder="name@company.com" required autoComplete="email" />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("submit")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("remember")}{" "}
              <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
                {t("signIn")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}