// src/lib/search.api.ts

import api from './api'

export interface SearchResult {
  documentId: string
  titre: string
  excerpt: string
  workspaceId: string
  workspaceNom: string
  dossierId: string | null
  dossierNom: string | null
  dateMiseAJour: string
  matchType: 'fulltext' | 'semantic' | 'both'
  score: number
}

export const searchApi = {
  search: (workspaceId: string, q: string): Promise<SearchResult[]> =>
    api.get(`/search/${workspaceId}`, { params: { q } }).then((r) => r.data),
}