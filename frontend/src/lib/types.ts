export type Role = 'LECTEUR' | 'EDITEUR' | 'ADMINISTRATEUR' | 'PROPRIETAIRE'

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