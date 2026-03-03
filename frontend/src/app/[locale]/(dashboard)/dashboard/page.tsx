"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@/store/auth.store"
import { workspaceApi } from "@/lib/workspace.api"
import { Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import {
  Plus, FolderOpen, Users, ArrowRight,
  Loader2, FileText, Star, Activity,
  TrendingUp, Clock
} from "lucide-react"
import { cn } from "@/lib/utils"

const roleColors: Record<string, string> = {
  PROPRIETAIRE: "bg-primary/10 text-primary",
  ADMINISTRATEUR: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  EDITEUR: "bg-green-500/10 text-green-600 dark:text-green-400",
  LECTEUR: "bg-muted text-muted-foreground",
}

const roleLabels: Record<string, string> = {
  PROPRIETAIRE: "Owner",
  ADMINISTRATEUR: "Admin",
  EDITEUR: "Editor",
  LECTEUR: "Viewer",
}

// Placeholder activity data - will be real in Sprint 3
const mockActivity = [
  { initials: "MJ", name: "Marcus Johnson", action: "edited", doc: "Q1 2026 Roadmap", time: "11 days ago" },
  { initials: "SM", name: "Sarah Miller", action: "created", doc: "REST API Reference", time: "12 days ago" },
  { initials: "OP", name: "Olivia Park", action: "commented on", doc: "Feature Spec: Smart Templates", time: "13 days ago" },
  { initials: "SM", name: "Sarah Miller", action: "edited", doc: "Authentication Guide", time: "16 days ago" },
  { initials: "JC", name: "James Chen", action: "edited", doc: "Database Schema Design", time: "21 days ago" },
]

const mockStarred = [
  { title: "Q1 2026 Roadmap", author: "Marcus Johnson", time: "11 days ago" },
  { title: "REST API Reference", author: "Sarah Miller", time: "12 days ago" },
  { title: "Feature Spec: Smart Templates", author: "Marcus Johnson", time: "13 days ago" },
  { title: "Authentication Guide", author: "Sarah Miller", time: "16 days ago" },
]

export default function DashboardPage() {
  const params = useParams()
  const locale = params.locale as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [nom, setNom] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")

  const { data: workspaces, isLoading } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] })
      setCreateOpen(false)
      setNom("")
      setDescription("")
      router.push(`/${locale}/workspace/${workspace.id}`)
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Something went wrong.")
    },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setError("")
    createMutation.mutate({ nom: nom.trim(), description: description.trim() || undefined })
  }

  const totalMembers = workspaces?.reduce((acc, ws) => acc + ws._count.membres, 0) ?? 0
  const firstName = user?.nom?.split(" ")[0] ?? "there"

  const stats = [
    { label: "Total Workspaces", value: workspaces?.length ?? 0, icon: FolderOpen, color: "text-primary bg-primary/10" },
    { label: "Total Documents", value: 0, icon: FileText, color: "text-blue-500 bg-blue-500/10" },
    { label: "Team Members", value: totalMembers, icon: Users, color: "text-green-500 bg-green-500/10" },
    { label: "Starred", value: 0, icon: Star, color: "text-yellow-500 bg-yellow-500/10" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">

      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's an overview of your workspace activity.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 hidden sm:flex">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
            <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-lg", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main grid: starred docs + activity */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Starred / Recent Documents */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold text-foreground">Starred Recent Documents</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {mockStarred.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.author} · {doc.time}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground">Documents coming in Sprint 3</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Recent Activity</h3>
          </div>
          <div className="divide-y divide-border">
            {mockActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {item.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{item.name}</span>
                    {" "}{item.action}{" "}
                    <span className="font-medium">{item.doc}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workspaces section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">My Workspaces</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces && workspaces.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => router.push(`/${locale}/workspace/${ws.id}`)}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                    {ws.nom[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                      {ws.nom}
                    </p>
                    <span className={cn("text-xs font-medium", roleColors[ws.monRole])}>
                      {roleLabels[ws.monRole]}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                {ws.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{ws.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-auto">
                  <Users className="h-3.5 w-3.5" />
                  <span>{ws._count.membres} members</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">No workspaces yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Create your first workspace to start organizing your team's knowledge.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-5 gap-2" size="sm">
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A workspace is a shared space for your team's documents.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Workspace name</Label>
              <Input
                id="nom"
                placeholder="e.g. Engineering Team"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this workspace for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Workspace
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}