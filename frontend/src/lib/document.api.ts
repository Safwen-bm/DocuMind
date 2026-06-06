import api from "./api";

// Reads the JS-accessible cookie set by the backend after login.
// Used only for raw fetch() calls (blob downloads) that can't go through axios.
function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const documentApi = {
  // ── Documents ─────────────────────────────────────────────────────────────

  create: (workspaceId: string, data: { titre?: string; dossierId?: string }) =>
    api.post(`/workspaces/${workspaceId}/documents`, data).then((r) => r.data),

  getAll: (workspaceId: string, dossierId?: string) =>
    api
      .get(`/workspaces/${workspaceId}/documents`, {
        params: dossierId !== undefined ? { dossierId } : {},
      })
      .then((r) => r.data),

  getOne: (id: string) => api.get(`/documents/${id}`).then((r) => r.data),

  update: (id: string, data: { titre?: string; contenu?: any }) =>
    api.patch(`/documents/${id}`, data).then((r) => r.data),

  updateSilent: (id: string, data: { titre?: string; contenu?: any }) =>
    api.patch(`/documents/${id}/silent`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data),

  toggleFavori: (id: string) =>
    api.post(`/documents/${id}/favori`).then((r) => r.data),

  moveDocument: (id: string, dossierId: string | null) =>
    api.patch(`/documents/${id}/move`, { dossierId }).then((r) => r.data),

  getVersions: (id: string) =>
    api.get(`/documents/${id}/versions`).then((r) => r.data),

  restoreVersion: (id: string, versionId: string) =>
    api.post(`/documents/${id}/restore/${versionId}`).then((r) => r.data),

  // ── Upload PDF / DOCX / XLSX → creates document in workspace ─────────────

  uploadFile: (workspaceId: string, file: File, dossierId?: string | null) => {
    const formData = new FormData();
    formData.append("file", file);
    const params = dossierId ? `?dossierId=${dossierId}` : "";
    return api
      .post(`/workspaces/${workspaceId}/documents/upload${params}`, formData)
      .then((r) => r.data);
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────

  getRecent: () => api.get("/documents/recent").then((r) => r.data),

  getFavoris: () => api.get("/documents/favoris").then((r) => r.data),

  getStats: () => api.get("/documents/stats").then((r) => r.data),

  // ── Folders ───────────────────────────────────────────────────────────────

  getFolders: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/folders`).then((r) => r.data),

  createFolder: (workspaceId: string, data: { nom: string; parentId?: string }) =>
    api.post(`/workspaces/${workspaceId}/folders`, data).then((r) => r.data),

  updateFolder: (workspaceId: string, id: string, nom: string) =>
    api.patch(`/workspaces/${workspaceId}/folders/${id}`, { nom }).then((r) => r.data),

  deleteFolder: (workspaceId: string, id: string) =>
    api.delete(`/workspaces/${workspaceId}/folders/${id}`).then((r) => r.data),

  moveFolder: (workspaceId: string, id: string, parentId: string | null) =>
    api
      .patch(`/workspaces/${workspaceId}/folders/${id}/move`, { parentId })
      .then((r) => r.data),

  getFolderContents: (workspaceId: string, folderId: string) =>
    api
      .get(`/workspaces/${workspaceId}/folders/${folderId}/contents`)
      .then((r) => r.data),

  // ── Export / Download ─────────────────────────────────────────────────────
  // These use raw fetch() because axios can't trigger a file download from a
  // blob response. Bearer token is read manually since axios interceptors don't
  // apply here.

  exportPdf: async (id: string, titre: string) => {
    const token = getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/documents/${id}/export/pdf`,
      {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) throw new Error(`Export PDF échoué: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titre || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  exportDocx: async (id: string, titre: string) => {
    const token = getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/documents/${id}/export/docx`,
      {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) throw new Error(`Export DOCX échoué: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titre || "document"}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  exportExcel: async (id: string, titre: string) => {
    const token = getToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/documents/${id}/export/excel`,
      {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) throw new Error(`Export Excel échoué: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titre || "document"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};