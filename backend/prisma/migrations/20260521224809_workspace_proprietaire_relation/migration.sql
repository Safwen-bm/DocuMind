-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
