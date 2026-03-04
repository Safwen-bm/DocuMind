export type Role = 'LECTEUR' | 'EDITEUR' | 'ADMINISTRATEUR' | 'PROPRIETAIRE'

export type ActionType =
  | 'DOCUMENT_CREE'
  | 'DOCUMENT_MODIFIE'
  | 'DOCUMENT_SUPPRIME'
  | 'DOCUMENT_FAVORI'
  | 'DOSSIER_CREE'
  | 'DOSSIER_SUPPRIME'
  | 'MEMBRE_INVITE'
  | 'MEMBRE_REJOINT'
  | 'VERSION_RESTAUREE'

export type NotificationType =
  | 'INVITATION'
  | 'MENTION'
  | 'DOCUMENT_PARTAGE'
  | 'MEMBRE_REJOINT'
  | 'SYSTEME'

export interface Workspace {
  id: string
  nom: string
  description: string | null
  proprietaireId: string
  logoUrl: string | null
  dateCreation: string
  dateMiseAJour: string
  monRole: Role
  _count: { membres: number }
}

export interface Member {
  id: string
  utilisateurId: string
  workspaceId: string
  role: Role
  dateAdhesion: string
  utilisateur: {
    id: string
    nom: string
    email: string
    avatarUrl: string | null
  }
}

export interface Dossier {
  id: string
  nom: string
  workspaceId: string
  parentId: string | null
  createdById: string | null
  dateCreation: string
  _count: { documents: number; enfants: number }
}

export interface Document {
  id: string
  titre: string
  contenu: any
  workspaceId: string
  dossierId: string | null
  authorId: string
  estFavori: boolean
  estArchive: boolean
  dateCreation: string
  dateMiseAJour: string
  author: { id: string; nom: string; avatarUrl: string | null }
  dossier: { id: string; nom: string } | null
  workspace?: { id: string; nom: string }
  _count?: { versions: number }
}

export interface VersionDocument {
  id: string
  documentId: string
  contenu: any
  numero: number
  createdById: string
  dateCreation: string
  createdBy: { id: string; nom: string; avatarUrl: string | null }
}

export interface Activite {
  id: string
  workspaceId: string
  userId: string
  action: ActionType
  cible: string
  cibleId: string | null
  dateCreation: string
  user: { id: string; nom: string; avatarUrl: string | null }
}

export interface Notification {
  id: string
  userId: string
  workspaceId: string | null
  type: NotificationType
  message: string
  lu: boolean
  lien: string | null
  dateCreation: string
}

export interface DocumentStats {
  totalDocuments: number
  totalFavoris: number
}