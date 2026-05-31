// frontend/src/app/[locale]/(auth)/invitations/accept/page.tsx

"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQueryClient } from "@tanstack/react-query"
import { workspaceApi } from "@/lib/workspace.api"
import { useAuthStore } from "@/store/auth.store"
import { Button } from "@/components/ui/button"
import { Brain, CheckCircle, XCircle, Loader2, Shield, User, Eye } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Role label + color helper
const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PROPRIETAIRE: { label: "Owner",         color: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",  icon: Shield },
  ADMINISTRATEUR: { label: "Admin",       color: "text-red-600 bg-red-500/10 border-red-500/20",           icon: Shield },
  EDITEUR:      { label: "Editor",        color: "text-blue-600 bg-blue-500/10 border-blue-500/20",        icon: User   },
  LECTEUR:      { label: "Viewer",        color: "text-muted-foreground bg-muted border-border",            icon: Eye    },
}

type PageStatus = "loading" | "preview" | "accepting" | "declining" | "success" | "declined" | "error"

interface InvitePreview {
  workspaceId: string
  workspaceName: string
  workspaceLogo: string | null
  role: string
  email: string
  expiresAt: string
}

export default function AcceptInvitationPage() {
  const params = useParams()
  const locale = params.locale as string
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()

  const [status, setStatus] = useState<PageStatus>("loading")
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")

  // ── Step 1: load preview ────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setErrorMsg("No invitation token found.")
      setStatus("error")
      return
    }
    if (!isAuthenticated) {
      router.push(`/${locale}/login?redirect=/invitations/accept?token=${token}`)
      return
    }
    loadPreview()
  }, [token, isAuthenticated])

  async function loadPreview() {
    if (!token) return
    setStatus("loading")
    try {
      const data = await workspaceApi.previewInvitation(token)
      setPreview(data)
      setStatus("preview")
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Cette invitation est invalide ou a expiré.")
      setStatus("error")
    }
  }

  // ── Step 2a: accept ─────────────────────────────────────────────────────────

  async function handleAccept() {
    if (!token) return
    setStatus("accepting")
    try {
      const result = await workspaceApi.acceptInvitation(token)
      setWorkspaceId(result.workspaceId)

      // Invalidate workspaces so the sidebar refreshes immediately — no reload needed
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] })

      setStatus("success")
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Une erreur est survenue.")
      setStatus("error")
    }
  }

  // ── Step 2b: decline ────────────────────────────────────────────────────────

  async function handleDecline() {
    if (!token) return
    setStatus("declining")
    try {
      await workspaceApi.declineInvitation(token)
      setStatus("declined")
    } catch (err: any) {
      // If token is already gone that's fine — treat as declined
      setStatus("declined")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const roleMeta = preview ? (ROLE_META[preview.role] ?? ROLE_META.LECTEUR) : null
  const RoleIcon = roleMeta?.icon ?? Eye

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Brain className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">

          {/* ── Loading ── */}
          {(status === "loading" || status === "accepting" || status === "declining") && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {status === "accepting" ? "Joining workspace…"
                  : status === "declining" ? "Declining invitation…"
                  : "Loading invitation…"}
              </p>
            </>
          )}

          {/* ── Preview: show workspace + role, let user decide ── */}
          {status === "preview" && preview && (
            <>
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 mb-4">
                {preview.workspaceLogo
                  ? <img src={preview.workspaceLogo} alt={preview.workspaceName} className="h-10 w-10 rounded-xl object-cover" />
                  : <span className="text-2xl font-bold text-primary">{preview.workspaceName[0].toUpperCase()}</span>
                }
              </div>

              <h1 className="text-xl font-bold text-foreground mb-1">
                You've been invited
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                Join <span className="font-semibold text-foreground">{preview.workspaceName}</span> on DocuMind
              </p>

              {/* Role badge */}
              <div className="flex justify-center mb-6">
                <div className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                  roleMeta?.color
                )}>
                  <RoleIcon className="h-4 w-4" />
                  Your role: <span className="font-bold">{roleMeta?.label}</span>
                </div>
              </div>

              {/* Role description */}
              <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground mb-6 text-left space-y-1">
                {preview.role === "EDITEUR" && (
                  <p>As an <strong>Editor</strong> you can create, edit, and delete documents.</p>
                )}
                {preview.role === "LECTEUR" && (
                  <p>As a <strong>Viewer</strong> you can read documents but not edit them.</p>
                )}
                {preview.role === "ADMINISTRATEUR" && (
                  <p>As an <strong>Admin</strong> you can manage members and all documents.</p>
                )}
                <p className="text-muted-foreground/60 pt-1">
                  Invitation sent to <span className="font-medium">{preview.email}</span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDecline}
                >
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAccept}
                >
                  Accept & Join
                </Button>
              </div>
            </>
          )}

          {/* ── Success ── */}
          {status === "success" && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h1 className="text-xl font-bold mb-2">You're in!</h1>
              <p className="text-sm text-muted-foreground mb-6">
                You've joined <span className="font-semibold text-foreground">{preview?.workspaceName}</span>.
                The workspace is now in your sidebar.
              </p>
              <Button asChild className="w-full">
                <Link href={`/${locale}/workspace/${workspaceId}`}>
                  Go to workspace
                </Link>
              </Button>
            </>
          )}

          {/* ── Declined ── */}
          {status === "declined" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h1 className="text-xl font-bold mb-2">Invitation declined</h1>
              <p className="text-sm text-muted-foreground mb-6">
                You've declined the invitation to{" "}
                <span className="font-semibold text-foreground">{preview?.workspaceName}</span>.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/dashboard`}>Go to dashboard</Link>
              </Button>
            </>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h1 className="text-xl font-bold mb-2">Invalid invitation</h1>
              <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/dashboard`}>Go to dashboard</Link>
              </Button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}