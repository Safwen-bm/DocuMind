-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_dossierId_fkey";

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
