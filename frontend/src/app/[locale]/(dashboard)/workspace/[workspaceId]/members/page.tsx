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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, UserPlus, Loader2, Trash2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const roleColors: Record<string, string> = {
  PROPRIETAIRE: "bg-primary/10 text-primary border-primary/20",
  ADMINISTRATEUR: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  EDITEUR: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  LECTEUR: "bg-muted text-muted-foreground border-border",
}

const ROLES: Role[] = ["LECTEUR", "EDITEUR", "ADMINISTRATEUR"]

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

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError("")
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("workspace.members.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members?.length ?? 0} {t("workspace.membersCount")}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t("workspace.members.invite")}
          </Button>
        )}
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {members?.map((member) => {
            const isMe = member.utilisateur.id === user?.id
            const isOwner = member.role === "PROPRIETAIRE"
            const initials = member.utilisateur.nom
              .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">
                      {member.utilisateur.nom}
                    </p>
                    {isMe && (
                      <span className="text-xs text-muted-foreground">
                        ({t("workspace.members.you")})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {member.utilisateur.email}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn("flex-shrink-0 text-xs", roleColors[member.role])}
                >
                  {t(`workspace.roles.${member.role}`)}
                </Badge>

                {canManage && !isMe && !isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ROLES.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => updateRoleMutation.mutate({ userId: member.utilisateur.id, role })}
                          className={member.role === role ? "bg-primary/10 font-medium" : ""}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {t(`workspace.roles.${role}`)}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeMutation.mutate(member.utilisateur.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("workspace.members.remove")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace.invite.title")}</DialogTitle>
          </DialogHeader>
          {inviteSuccess ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-medium text-foreground">{t("workspace.invite.success")}</p>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="mt-2 space-y-4">
              <div className="space-y-2">
                <Label>{t("workspace.invite.email")}</Label>
                <Input
                  type="email"
                  placeholder={t("workspace.invite.emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("workspace.invite.role")}</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`workspace.roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  {t("workspace.invite.cancel")}
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("workspace.invite.submit")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}