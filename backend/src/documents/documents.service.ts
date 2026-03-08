import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from '../activite/activite.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ActionType, Prisma, Role } from '@prisma/client';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private activite: ActiviteService,
    private aiService: AiService,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateDocumentDto) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const doc = await this.prisma.document.create({
      data: {
        titre: dto.titre ?? 'Sans titre',
        workspaceId,
        dossierId: dto.dossierId ?? null,
        authorId: userId,
        contenu: { type: 'doc', content: [] },
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });

    await this.activite.log({
      workspaceId,
      userId,
      action: ActionType.DOCUMENT_CREE,
      cible: doc.titre,
      cibleId: doc.id,
    });

    return doc;
  }

  async findAll(userId: string, workspaceId: string, dossierId?: string) {
    await this.checkMember(userId, workspaceId);

    return this.prisma.document.findMany({
      where: {
        workspaceId,
        estArchive: false,
        ...(dossierId !== undefined ? { dossierId: dossierId || null } : {}),
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
        _count: { select: { versions: true } },
      },
      orderBy: { dateMiseAJour: 'desc' },
    });
  }

  async findOne(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
        workspace: { select: { id: true, nom: true } },
      },
    });

    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkMember(userId, doc.workspaceId);
    return doc;
  }

  async update(userId: string, documentId: string, dto: UpdateDocumentDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    // Auto-version on content save
    if (dto.contenu !== undefined) {
      const lastVersion = await this.prisma.versionDocument.findFirst({
        where: { documentId },
        orderBy: { numero: 'desc' },
      });

      // Snapshot the OLD content before overwriting
      await this.prisma.versionDocument.create({
        data: {
          documentId,
          contenu: (doc.contenu as Prisma.InputJsonValue) ?? {
            type: 'doc',
            content: [],
          },
          numero: (lastVersion?.numero ?? 0) + 1,
          createdById: userId,
        },
      });

      await this.activite.log({
        workspaceId: doc.workspaceId,
        userId,
        action: ActionType.DOCUMENT_MODIFIE,
        cible: doc.titre,
        cibleId: doc.id,
      });
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(dto.titre !== undefined && { titre: dto.titre }),
        ...(dto.contenu !== undefined && { contenu: dto.contenu }),
        ...(dto.estFavori !== undefined && { estFavori: dto.estFavori }),
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });

    if (dto.estFavori !== undefined) {
      await this.activite.log({
        workspaceId: doc.workspaceId,
        userId,
        action: ActionType.DOCUMENT_FAVORI,
        cible: doc.titre,
        cibleId: doc.id,
      });
    }

    if (dto.contenu !== undefined) {
      this.aiService.indexDocument(updated.id).catch(console.error);
    }

    return updated;
  }

  async remove(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    await this.prisma.document.delete({ where: { id: documentId } });

    await this.activite.log({
      workspaceId: doc.workspaceId,
      userId,
      action: ActionType.DOCUMENT_SUPPRIME,
      cible: doc.titre,
      cibleId: documentId,
    });

    return { message: 'Document supprimé.' };
  }

  async getVersions(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkMember(userId, doc.workspaceId);

    return this.prisma.versionDocument.findMany({
      where: { documentId },
      include: {
        createdBy: { select: { id: true, nom: true, avatarUrl: true } },
      },
      orderBy: { numero: 'desc' },
    });
  }

  async restoreVersion(userId: string, documentId: string, versionId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const version = await this.prisma.versionDocument.findFirst({
      where: { id: versionId, documentId },
    });
    if (!version) throw new NotFoundException('Version introuvable.');

    // Save current as new version before restoring
    const lastVersion = await this.prisma.versionDocument.findFirst({
      where: { documentId },
      orderBy: { numero: 'desc' },
    });

    if (doc.contenu !== null && doc.contenu !== undefined) {
      await this.prisma.versionDocument.create({
        data: {
          documentId,
          contenu: doc.contenu as Prisma.InputJsonValue,
          numero: (lastVersion?.numero ?? 0) + 1,
          createdById: userId,
        },
      });
    }

    const restored = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        contenu:
          version.contenu === null
            ? Prisma.JsonNull
            : (version.contenu as Prisma.InputJsonValue),
      },
    });

    await this.activite.log({
      workspaceId: doc.workspaceId,
      userId,
      action: ActionType.VERSION_RESTAUREE,
      cible: doc.titre,
      cibleId: doc.id,
    });

    return restored;
  }

  async getRecentAcrossWorkspaces(userId: string) {
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    return this.prisma.document.findMany({
      where: { workspaceId: { in: workspaceIds }, estArchive: false },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        workspace: { select: { id: true, nom: true } },
      },
      orderBy: { dateMiseAJour: 'desc' },
      take: 5,
    });
  }

  async getFavoris(userId: string) {
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    return this.prisma.document.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        estFavori: true,
        estArchive: false,
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        workspace: { select: { id: true, nom: true } },
      },
      orderBy: { dateMiseAJour: 'desc' },
      take: 5,
    });
  }

  async getStats(userId: string) {
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const [totalDocuments, totalFavoris] = await Promise.all([
      this.prisma.document.count({
        where: { workspaceId: { in: workspaceIds }, estArchive: false },
      }),
      this.prisma.document.count({
        where: {
          workspaceId: { in: workspaceIds },
          estFavori: true,
          estArchive: false,
        },
      }),
    ]);

    return { totalDocuments, totalFavoris };
  }

  private async checkMember(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');
    return membre;
  }

  private async checkRole(userId: string, workspaceId: string, roles: Role[]) {
    const membre = await this.checkMember(userId, workspaceId);
    const hierarchy = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];
    const hasRole = roles.some(
      (r) => hierarchy.indexOf(membre.role) >= hierarchy.indexOf(r),
    );
    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');
  }

  async updateSilent(
    userId: string,
    documentId: string,
    data: { titre?: string; contenu?: any },
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(data.titre !== undefined && { titre: data.titre }),
        ...(data.contenu !== undefined && { contenu: data.contenu }),
      },
    });
  }

  // Add this method to DocumentsService in documents.service.ts

  async moveDocument(
    userId: string,
    documentId: string,
    dossierId: string | null,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    // If dossierId provided, validate it belongs to same workspace
    if (dossierId) {
      const dossier = await this.prisma.dossier.findFirst({
        where: { id: dossierId, workspaceId: doc.workspaceId },
      });
      if (!dossier) throw new NotFoundException('Dossier introuvable.');
    }

    return this.prisma.document.update({
      where: { id: documentId },
      data: { dossierId: dossierId ?? null },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });
  }
}
