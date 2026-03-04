import api from "./api";

export const documentApi = {
  // Documents
  create: (workspaceId: string, data: { titre?: string; dossierId?: string }) =>
    api.post(`/workspaces/${workspaceId}/documents`, data).then((r) => r.data),

  getAll: (workspaceId: string, dossierId?: string) =>
    api
      .get(`/workspaces/${workspaceId}/documents`, {
        params: dossierId !== undefined ? { dossierId } : {},
      })
      .then((r) => r.data),

  getOne: (id: string) => api.get(`/documents/${id}`).then((r) => r.data),

  update: (
    id: string,
    data: { titre?: string; contenu?: any; estFavori?: boolean },
  ) => api.patch(`/documents/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data),

  toggleFavori: (id: string, estFavori: boolean) =>
    api.patch(`/documents/${id}`, { estFavori }).then((r) => r.data),

  getVersions: (id: string) =>
    api.get(`/documents/${id}/versions`).then((r) => r.data),

  restoreVersion: (id: string, versionId: string) =>
    api.post(`/documents/${id}/restore/${versionId}`).then((r) => r.data),

  // Dashboard data
  getRecent: () => api.get("/documents/recent").then((r) => r.data),

  getFavoris: () => api.get("/documents/favoris").then((r) => r.data),

  getStats: () => api.get("/documents/stats").then((r) => r.data),

  // Folders
  getFolders: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/folders`).then((r) => r.data),

  createFolder: (
    workspaceId: string,
    data: { nom: string; parentId?: string },
  ) => api.post(`/workspaces/${workspaceId}/folders`, data).then((r) => r.data),

  updateFolder: (workspaceId: string, id: string, nom: string) =>
    api
      .patch(`/workspaces/${workspaceId}/folders/${id}`, { nom })
      .then((r) => r.data),

  deleteFolder: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/folders/${id}`).then((r) => r.data),

  updateSilent: (id: string, data: { titre?: string; contenu?: any }) =>
    api.patch(`/documents/${id}/silent`, data).then((r) => r.data),
};
