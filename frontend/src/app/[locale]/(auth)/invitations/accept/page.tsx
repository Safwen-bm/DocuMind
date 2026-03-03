"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { workspaceApi } from "@/lib/workspace.api"
import { useAuthStore } from "@/store/auth.store"
import { Button } from "@/components/ui/button"
import { Brain, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function AcceptInvitationPage() {
  const params = useParams()
  const locale = params.locale as string
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const router = useRouter()
  const t = useTranslations("dashboard.invitation")
  const { isAuthenticated } = useAuthStore()

  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      return
    }
    if (!isAuthenticated) {
      // Save token in URL and redirect to login
      router.push(`/${locale}/login?redirect=/invitations/accept?token=${token}`)
      return
    }
    handleAccept()
  }, [token, isAuthenticated])

  async function handleAccept() {
    if (!token) return
    setStatus("loading")
    try {
      const result = await workspaceApi.acceptInvitation(token)
      setWorkspaceId(result.workspaceId)
      setStatus("success")
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || t("invalid"))
      setStatus("error")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Brain className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        {status === "idle" || status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("accepting")}</p>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t("success")}</h1>
            <Button asChild className="mt-6">
              <Link href={`/${locale}/workspace/${workspaceId}`}>
                {t("goToDashboard")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t("invalid")}</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href={`/${locale}/dashboard`}>
                {t("goToDashboard")}
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}