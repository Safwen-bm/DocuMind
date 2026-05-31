/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,dossierId,titre]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,parentId,nom]` on the table `dossiers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[proprietaireId,nom]` on the table `workspaces` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "documents_workspaceId_dossierId_titre_key" ON "documents"("workspaceId", "dossierId", "titre");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_workspaceId_parentId_nom_key" ON "dossiers"("workspaceId", "parentId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_proprietaireId_nom_key" ON "workspaces"("proprietaireId", "nom");
