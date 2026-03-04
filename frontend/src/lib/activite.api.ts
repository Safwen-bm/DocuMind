import api from './api'

export const activiteApi = {
  getByWorkspace: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/activity`).then(r => r.data),
}