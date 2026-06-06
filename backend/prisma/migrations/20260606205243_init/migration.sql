CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('CONFIRMATION_EMAIL', 'RESET_MOT_DE_PASSE', 'OTP_2FA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LECTEUR', 'EDITEUR', 'ADMINISTRATEUR', 'PROPRIETAIRE');

-- CreateEnum
CREATE TYPE "RoleIA" AS ENUM ('UTILISATEUR', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('DOCUMENT_CREE', 'DOCUMENT_MODIFIE', 'DOCUMENT_SUPPRIME', 'DOCUMENT_FAVORI', 'DOSSIER_CREE', 'DOSSIER_SUPPRIME', 'MEMBRE_INVITE', 'MEMBRE_REJOINT', 'VERSION_RESTAUREE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVITATION', 'MENTION', 'DOCUMENT_PARTAGE', 'MEMBRE_REJOINT', 'COMMENTAIRE', 'NOUVEAU_DOCUMENT', 'DOCUMENT_MODIFIE', 'ROLE_MODIFIE', 'MEMBRE_RETIRE', 'SYSTEME');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('READ', 'EDIT');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "estActif" BOOLEAN NOT NULL DEFAULT false,
    "tentativesEchec" INTEGER NOT NULL DEFAULT 0,
    "verrouillageJusqua" TIMESTAMP(3),
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_verification" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "proprietaireId" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membres_workspace" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "dateAdhesion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estRetire" BOOLEAN NOT NULL DEFAULT false,
    "dateRetrait" TIMESTAMP(3),

    CONSTRAINT "membres_workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LECTEUR',
    "expiration" TIMESTAMP(3) NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL DEFAULT 'Sans titre',
    "contenu" JSONB,
    "workspaceId" TEXT NOT NULL,
    "dossierId" TEXT,
    "authorId" TEXT NOT NULL,
    "estArchive" BOOLEAN NOT NULL DEFAULT false,
    "estIndexe" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_views" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_document" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "numero" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "embedding" vector(3072) NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires" (
    "id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "estResolu" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commentaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT,
    "titre" TEXT NOT NULL DEFAULT 'New conversation',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_ia" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "RoleIA" NOT NULL,
    "contenu" TEXT NOT NULL,
    "sources" JSONB,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActionType" NOT NULL,
    "cible" TEXT NOT NULL,
    "cibleId" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "lien" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_favoris" (
    "utilisateurId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_favoris_pkey" PRIMARY KEY ("utilisateurId","documentId")
);

-- CreateTable
CREATE TABLE "share_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'READ',
    "expiresAt" TIMESTAMP(3),
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_verification_token_key" ON "tokens_verification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_proprietaireId_nom_key" ON "workspaces"("proprietaireId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "membres_workspace_utilisateurId_workspaceId_key" ON "membres_workspace"("utilisateurId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_workspaceId_parentId_nom_key" ON "dossiers"("workspaceId", "parentId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "documents_workspaceId_dossierId_titre_key" ON "documents"("workspaceId", "dossierId", "titre");

-- CreateIndex
CREATE UNIQUE INDEX "document_views_documentId_userId_key" ON "document_views"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "share_tokens_token_key" ON "share_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_workspaceId_key" ON "subscriptions"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_userId_workspaceId_date_key" ON "ai_usage"("userId", "workspaceId", "date");

-- AddForeignKey
ALTER TABLE "tokens_verification" ADD CONSTRAINT "tokens_verification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membres_workspace" ADD CONSTRAINT "membres_workspace_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membres_workspace" ADD CONSTRAINT "membres_workspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_views" ADD CONSTRAINT "document_views_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_views" ADD CONSTRAINT "document_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_document" ADD CONSTRAINT "versions_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_document" ADD CONSTRAINT "versions_document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_ia" ADD CONSTRAINT "messages_ia_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites" ADD CONSTRAINT "activites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites" ADD CONSTRAINT "activites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favoris" ADD CONSTRAINT "document_favoris_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favoris" ADD CONSTRAINT "document_favoris_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
