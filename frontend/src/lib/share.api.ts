// src/lib/share.api.ts

import api from './api'

export type SharePermission = 'READ' | 'EDIT'

export interface ShareLink {
  id: string
  token: string
  documentId: string
  permission: SharePermission
  expiresAt: string | null
  dateCreation: string
}

export interface CreateShareResponse {
  token: string
  url: string
  permission: SharePermission
  expiresAt: string | null
}

export interface SharedDocument {
  document: {
    id: string
    titre: string
    contenu: any
    workspaceId: string
    author: { id: string; nom: string; avatarUrl: string | null }
    workspace: { id: string; nom: string }
    dossier: { id: string; nom: string } | null
    dateMiseAJour: string
  }
  permission: SharePermission
  expiresAt: string | null
}

export const shareApi = {
  createLink: (
    docId: string,
    permission: SharePermission,
    expiresInDays?: number,
  ): Promise<CreateShareResponse> =>
    api
      .post(`/documents/${docId}/share`, { permission, expiresInDays })
      .then((r) => r.data),

  getLinks: (docId: string): Promise<ShareLink[]> =>
    api.get(`/documents/${docId}/share`).then((r) => r.data),

  revokeLink: (tokenId: string): Promise<{ deleted: true }> =>
    api.delete(`/share/tokens/${tokenId}`).then((r) => r.data),

  resolveToken: (token: string): Promise<SharedDocument> =>
    api.get(`/share/${token}`).then((r) => r.data),
}