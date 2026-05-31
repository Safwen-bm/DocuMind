// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\lib\activite.api.ts

import api from './api'
import { ActionType } from './types'

export interface AdminLogsQuery {
  page?: number
  limit?: number
  action?: ActionType | ''
  userId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface AdminLogsResult {
  logs: {
    id: string
    action: ActionType
    cible: string
    cibleId: string | null
    dateCreation: string
    user: { id: string; nom: string; avatarUrl: string | null; email: string }
  }[]
  total: number
  page: number
  totalPages: number
}

export interface AdminLogsSummary {
  total: number
  last24h: number
  last7d: number
  byAction: { action: ActionType; count: number }[]
  activeUserCount: number
}

export interface AdminLogsMember {
  utilisateur: { id: string; nom: string; email: string; avatarUrl: string | null }
  role: string
}

export const activiteApi = {
  getByWorkspace: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/activity`).then((r) => r.data),

  // Admin logs — ADMINISTRATEUR+ only
  getAdminLogs: (workspaceId: string, query: AdminLogsQuery = {}): Promise<AdminLogsResult> => {
    const params = new URLSearchParams()
    if (query.page) params.set('page', String(query.page))
    if (query.limit) params.set('limit', String(query.limit))
    if (query.action) params.set('action', query.action)
    if (query.userId) params.set('userId', query.userId)
    if (query.search) params.set('search', query.search)
    if (query.dateFrom) params.set('dateFrom', query.dateFrom)
    if (query.dateTo) params.set('dateTo', query.dateTo)
    const qs = params.toString()
    return api
      .get(`/workspaces/${workspaceId}/admin-logs${qs ? `?${qs}` : ''}`)
      .then((r) => r.data)
  },

  getAdminLogsSummary: (workspaceId: string): Promise<AdminLogsSummary> =>
    api.get(`/workspaces/${workspaceId}/admin-logs/summary`).then((r) => r.data),

  getAdminLogsMembers: (workspaceId: string): Promise<AdminLogsMember[]> =>
    api.get(`/workspaces/${workspaceId}/admin-logs/members`).then((r) => r.data),
}
