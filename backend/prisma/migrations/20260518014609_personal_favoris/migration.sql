/*
  Warnings:

  - You are about to drop the column `estFavori` on the `documents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "estFavori";

-- CreateTable
CREATE TABLE "document_favoris" (
    "utilisateurId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_favoris_pkey" PRIMARY KEY ("utilisateurId","documentId")
);

-- AddForeignKey
ALTER TABLE "document_favoris" ADD CONSTRAINT "document_favoris_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favoris" ADD CONSTRAINT "document_favoris_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
