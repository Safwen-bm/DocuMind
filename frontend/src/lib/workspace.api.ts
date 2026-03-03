import api from './api'
import { Role } from './types'

export const workspaceApi = {
  getAll: () => api.get('/workspaces').then(r => r.data),
  getOne: (id: string) => api.get(`/workspaces/${id}`).then(r => r.data),
  create: (data: { nom: string; description?: string }) =>
    api.post('/workspaces', data).then(r => r.data),
  update: (id: string, data: { nom?: string; description?: string }) =>
    api.patch(`/workspaces/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/workspaces/${id}`).then(r => r.data),

  // Members
  getMembers: (id: string) =>
    api.get(`/workspaces/${id}/members`).then(r => r.data),
  updateMemberRole: (workspaceId: string, userId: string, role: Role) =>
    api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }).then(r => r.data),
  removeMember: (workspaceId: string, userId: string) =>
    api.delete(`/workspaces/${workspaceId}/members/${userId}`).then(r => r.data),

  // Invitations
  invite: (workspaceId: string, data: { email: string; role: Role }) =>
    api.post(`/workspaces/${workspaceId}/invitations`, data).then(r => r.data),
  acceptInvitation: (token: string) =>
    api.get(`/invitations/accept?token=${token}`).then(r => r.data),
}