// src/lib/comments.api.ts

import api from './api';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommentAuteur {
  id: string;
  nom: string;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  contenu: string;
  documentId: string;
  auteurId: string;
  estResolu: boolean;
  dateCreation: string;
  dateMiseAJour: string;
  auteur: CommentAuteur;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const commentsApi = {
  // GET /documents/:documentId/comments
  getAll: (documentId: string): Promise<Comment[]> =>
    api.get(`/documents/${documentId}/comments`).then((r) => r.data),

  // POST /documents/:documentId/comments
  create: (documentId: string, contenu: string): Promise<Comment> =>
    api
      .post(`/documents/${documentId}/comments`, { contenu })
      .then((r) => r.data),

  // PATCH /documents/:documentId/comments/:commentId
  update: (
    documentId: string,
    commentId: string,
    contenu: string,
  ): Promise<Comment> =>
    api
      .patch(`/documents/${documentId}/comments/${commentId}`, { contenu })
      .then((r) => r.data),

  // PATCH /documents/:documentId/comments/:commentId/toggle-resolu
  toggleResolu: (documentId: string, commentId: string): Promise<Comment> =>
    api
      .patch(`/documents/${documentId}/comments/${commentId}/toggle-resolu`)
      .then((r) => r.data),

  // DELETE /documents/:documentId/comments/:commentId
  remove: (documentId: string, commentId: string): Promise<{ deleted: boolean }> =>
    api
      .delete(`/documents/${documentId}/comments/${commentId}`)
      .then((r) => r.data),
};