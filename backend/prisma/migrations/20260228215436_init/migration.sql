-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('CONFIRMATION_EMAIL', 'RESET_MOT_DE_PASSE', 'OTP_2FA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LECTEUR', 'EDITEUR', 'ADMINISTRATEUR', 'PROPRIETAIRE');

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

    CONSTRAINT "membres_workspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_verification_token_key" ON "tokens_verification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "membres_workspace_utilisateurId_workspaceId_key" ON "membres_workspace"("utilisateurId", "workspaceId");

-- AddForeignKey
ALTER TABLE "tokens_verification" ADD CONSTRAINT "tokens_verification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membres_workspace" ADD CONSTRAINT "membres_workspace_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membres_workspace" ADD CONSTRAINT "membres_workspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
