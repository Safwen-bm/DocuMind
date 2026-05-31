// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\workspace\[workspaceId]\members\page.tsx

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/store/auth.store"
import { workspaceApi } from "@/lib/workspace.api"
import { Member, Role } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  MoreHorizontal, UserPlus, Loader2, Trash2,
  Shield, Users, CheckCircle2, Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"

const roleConfig: Record<string, { classes: string; dotColor: string }> = {
  PROPRIETAIRE: {
    classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
    dotColor: "bg-violet-500",
  },
  ADMINISTRATEUR: {
    classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    dotColor: "bg-blue-500",
  },
  EDITEUR: {
    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    dotColor: "bg-emerald-500",
  },
  LECTEUR: {
    classes: "bg-muted text-muted-foreground border border-border",
    dotColor: "bg-muted-foreground",
  },
}

const ROLES: Role[] = ["LECTEUR", "EDITEUR", "ADMINISTRATEUR"]

// Role ordering for display (owner first)
const ROLE_ORDER: Role[] = ["PROPRIETAIRE", "ADMINISTRATEUR", "EDITEUR", "LECTEUR"]

function MemberSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="h-9 w-9 animate-pulse rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-44 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

export default function MembersPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string
  const t = useTranslations("dashboard")
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("LECTEUR")
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["members", workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId),
  })

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: Role }) =>
      workspaceApi.invite(workspaceId, data),
    onSuccess: () => {
      setInviteSuccess(true)
      setInviteEmail("")
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] })
      setTimeout(() => {
        setInviteOpen(false)
        setInviteSuccess(false)
      }, 2000)
    },
    onError: (err: any) => {
      setInviteError(err.response?.data?.message || "Something went wrong.")
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      workspaceApi.updateMemberRole(workspaceId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => workspaceApi.removeMember(workspaceId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
  })

  const myRole = members?.find(m => m.utilisateur.id === user?.id)?.role
  const canManage = myRole === "PROPRIETAIRE" || myRole === "ADMINISTRATEUR"

  // Sort members by role hierarchy
  const sortedMembers = members
    ? [...members].sort(
        (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      )
    : []

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError("")
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
  }

  function handleOpenInvite() {
    setInviteEmail("")
    setInviteRole("LECTEUR")
    setInviteError("")
    setInviteSuccess(false)
    setInviteOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">

      {/* ── Page header — same pattern as overview & analytics ──────────── */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("workspace.members.title")}
            </h1>
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              {isLoading ? (
                <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
              ) : (
                <span>{members?.length ?? 0} {t("workspace.membersCount")}</span>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <Button size="sm" className="gap-1.5 hidden sm:flex shrink-0" onClick={handleOpenInvite}>
            <UserPlus className="h-4 w-4" />
            {t("workspace.members.invite")}
          </Button>
        )}
      </div>

      {/* ── Members list ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border/60">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <MemberSkeleton key={i} />)
          ) : sortedMembers.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                <Users className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("workspace.members.noMembers")}</p>
            </div>
          ) : (
            sortedMembers.map((member) => {
              const isMe = member.utilisateur.id === user?.id
              const isOwner = member.role === "PROPRIETAIRE"
              const cfg = roleConfig[member.role] ?? roleConfig.LECTEUR
              const initials = member.utilisateur.nom
                .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Avatar */}
                  <Avatar className="h-9 w-9 shrink-0">
                    {member.utilisateur.avatarUrl && (
                      <AvatarImage src={member.utilisateur.avatarUrl} alt={member.utilisateur.nom} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.utilisateur.nom}
                      </p>
                      {isMe && (
                        <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {t("workspace.members.you")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {member.utilisateur.email}
                    </p>
                  </div>

                  {/* Role badge */}
                  <span className={cn(
                    "hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md shrink-0",
                    cfg.classes,
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dotColor)} />
                    {t(`workspace.roles.${member.role}`)}
                  </span>

                  {/* Actions dropdown */}
                  {canManage && !isMe && !isOwner ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {t("workspace.members.changeRole")}
                        </div>
                        {ROLES.map((role) => {
                          const isActive = member.role === role
                          return (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => updateRoleMutation.mutate({ userId: member.utilisateur.id, role })}
                              className={cn("gap-2", isActive && "bg-primary/5 font-medium")}
                            >
                              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                              {t(`workspace.roles.${role}`)}
                              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                            </DropdownMenuItem>
                          )
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => removeMutation.mutate(member.utilisateur.id)}
                          className="text-destructive focus:text-destructive gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("workspace.members.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    // Empty placeholder to keep layout aligned
                    <div className="h-8 w-8 shrink-0" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Invite modal ────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace.invite.title")}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("workspace.invite.emailPlaceholder")}
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="font-semibold text-foreground">{t("workspace.invite.success")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{inviteEmail}</p>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t("workspace.invite.email")}</Label>
                <Input
                  type="email"
                  placeholder={t("workspace.invite.emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError("") }}
                  required
                  autoFocus
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t("workspace.invite.role")}</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => {
                      const cfg = roleConfig[role]
                      return (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dotColor)} />
                            {t(`workspace.roles.${role}`)}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {inviteError && (
                <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                  {inviteError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteOpen(false)}
                >
                  {t("workspace.invite.cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending
                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{t("workspace.invite.submit")}</>
                    : <><UserPlus className="mr-2 h-3.5 w-3.5" />{t("workspace.invite.submit")}</>
                  }
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}