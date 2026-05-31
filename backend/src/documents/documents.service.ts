// src/documents/documents.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from '../activite/activite.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ActionType, Prisma, Role } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private activite: ActiviteService,
    private aiService: AiService,
    private notifications: NotificationsService,
    private plans: PlansService,
  ) {}

  // ── Notify all workspace members except the actor ────────────────────────

  private async notifyWorkspaceMembers(
    workspaceId: string,
    excludeUserId: string,
    type: any,
    message: string,
    lien: string,
  ) {
    const membres = await this.prisma.membreWorkspace.findMany({
      where: { workspaceId },
      select: { utilisateurId: true },
    });
    Promise.all(
      membres
        .filter((m) => m.utilisateurId !== excludeUserId)
        .map((m) =>
          this.notifications.create({
            userId: m.utilisateurId,
            type,
            message,
            workspaceId,
            lien,
          }),
        ),
    ).catch(console.error);
  }

  // ── Attach isFavori flag to a list of documents ──────────────────────────

  private async attachFavori<T extends { id: string }>(
    docs: T[],
    userId: string,
  ): Promise<(T & { isFavori: boolean })[]> {
    if (docs.length === 0) return docs.map((d) => ({ ...d, isFavori: false }));
    const docIds = docs.map((d) => d.id);
    const favoris = await this.prisma.documentFavori.findMany({
      where: { utilisateurId: userId, documentId: { in: docIds } },
      select: { documentId: true },
    });
    const favoriSet = new Set(favoris.map((f) => f.documentId));
    return docs.map((d) => ({ ...d, isFavori: favoriSet.has(d.id) }));
  }

  /**
   * resolveUniqueTitle
   * ------------------
   * Guarantees that no two documents share the same (workspaceId, dossierId, titre).
   *
   * Algorithm:
   *   1. If `titre` is free → return it as-is.
   *   2. Strip any existing "(N)" suffix from the base name.
   *   3. Try "base (1)", "base (2)", … until a free slot is found.
   *
   * Used on CREATE, MOVE, and silent template injection — never throws.
   * `excludeId` lets us ignore the document being updated so it doesn't
   * conflict with itself.
   *
   * Examples:
   *   "report"      (free)          → "report"
   *   "report"      (taken)         → "report (1)"
   *   "report (1)"  (taken)         → "report (2)"   ← key fix vs old code
   *   "report (3)"  (1,2,3 taken)   → "report (4)"
   */
  private async resolveUniqueTitle(
    workspaceId: string,
    dossierId: string | null,
    titre: string,
    excludeId?: string,
  ): Promise<string> {
    const exists = async (name: string): Promise<boolean> => {
      const found = await this.prisma.document.findFirst({
        where: {
          workspaceId,
          dossierId: dossierId ?? null,
          titre: name,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      return !!found;
    };

    // Fast path — name is already free
    if (!(await exists(titre))) return titre;

    // Strip any trailing " (N)" so we always work from the clean base
    const base = titre.replace(/\s*\(\d+\)$/, '').trim();

    let counter = 1;
    while (await exists(`${base} (${counter})`)) {
      counter++;
    }
    return `${base} (${counter})`;
  }

  /**
   * assertTitleAvailableForUpdate
   * ------------------------------
   * Called ONLY on an explicit user rename (PATCH /documents/:id with a new
   * titre).  Throws 409 so the frontend can show a friendly conflict UI and
   * let the user decide: fix the name manually OR trigger auto-rename.
   */
  private async assertTitleAvailableForUpdate(
    workspaceId: string,
    dossierId: string | null,
    titre: string,
    excludeId: string,
  ) {
    const conflict = await this.prisma.document.findFirst({
      where: {
        workspaceId,
        dossierId: dossierId ?? null,
        titre,
        id: { not: excludeId },
      },
      select: { id: true },
    });
    if (conflict) {
      const location =
        dossierId ? 'dans ce dossier' : 'à la racine du workspace';
      throw new ConflictException(
        `Un document nommé "${titre}" existe déjà ${location}. Choisissez un autre titre.`,
      );
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async create(userId: string, workspaceId: string, dto: CreateDocumentDto) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);
  // ── Plan limit check ──────────────────────────────────────────────────
    await this.plans.assertCanCreateDocument(workspaceId);

    const rawTitre = dto.titre?.trim() || 'Sans titre';
    const dossierId = dto.dossierId ?? null;

    // Auto-rename: "text" → "text (1)" → "text (2)" — never throws 409
    const titre = await this.resolveUniqueTitle(workspaceId, dossierId, rawTitre);

    const doc = await this.prisma.document.create({
      data: {
        titre,
        workspaceId,
        dossierId,
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

    await this.notifyWorkspaceMembers(
      workspaceId,
      userId,
      'NOUVEAU_DOCUMENT',
      `${doc.author.nom} a créé un nouveau document "${doc.titre}".`,
      `/workspace/${workspaceId}/documents/${doc.id}`,
    );

    return { ...doc, isFavori: false };
  }

  // ── Read ────────────────────────────────────────────────────────────────

  async findAll(userId: string, workspaceId: string, dossierId?: string) {
    await this.checkMember(userId, workspaceId);

    const docs = await this.prisma.document.findMany({
      where: {
        workspaceId,
        estArchive: false,
        ...(dossierId !== undefined ? { dossierId: dossierId || null } : {}),
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
        _count: { select: { versions: true } },
        views: {
          include: { user: { select: { id: true, nom: true, avatarUrl: true } } },
          orderBy: { lastViewedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { dateMiseAJour: 'desc' },
    });

    return this.attachFavori(docs, userId);
  }

  async findOne(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
        workspace: { select: { id: true, nom: true } },
        views: {
          include: { user: { select: { id: true, nom: true, avatarUrl: true } } },
          orderBy: { lastViewedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkMember(userId, doc.workspaceId);

    // Track last-viewed — fire and forget, never block the response
    this.prisma.documentView
      .upsert({
        where: { documentId_userId: { documentId, userId } },
        create: { documentId, userId, lastViewedAt: new Date() },
        update: { lastViewedAt: new Date() },
      })
      .catch(() => {});

    const favori = await this.prisma.documentFavori.findUnique({
      where: {
        utilisateurId_documentId: { utilisateurId: userId, documentId },
      },
    });

    return { ...doc, isFavori: !!favori };
  }

  // ── Toggle favori ────────────────────────────────────────────────────────

  async toggleFavori(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true, titre: true },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkMember(userId, doc.workspaceId);

    const existing = await this.prisma.documentFavori.findUnique({
      where: {
        utilisateurId_documentId: { utilisateurId: userId, documentId },
      },
    });

    if (existing) {
      await this.prisma.documentFavori.delete({
        where: {
          utilisateurId_documentId: { utilisateurId: userId, documentId },
        },
      });
      return { isFavori: false };
    } else {
      await this.prisma.documentFavori.create({
        data: { utilisateurId: userId, documentId },
      });
      await this.activite.log({
        workspaceId: doc.workspaceId,
        userId,
        action: ActionType.DOCUMENT_FAVORI,
        cible: doc.titre,
        cibleId: doc.id,
      });
      return { isFavori: true };
    }
  }

  // ── Update (explicit user save — throws 409 on duplicate title) ───────────
  //
  // This is the ONLY method that can throw 409.  The frontend catches it and
  // shows an inline conflict banner with an "auto-rename" button.

  async update(userId: string, documentId: string, dto: UpdateDocumentDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { author: { select: { id: true, nom: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    // Explicit rename: throw 409 if the chosen name is already taken
    if (dto.titre !== undefined && dto.titre.trim() !== doc.titre) {
      await this.assertTitleAvailableForUpdate(
        doc.workspaceId,
        doc.dossierId,
        dto.titre.trim(),
        documentId,
      );
    }

    // Save a version snapshot whenever content changes
    if (dto.contenu !== undefined) {
      const lastVersion = await this.prisma.versionDocument.findFirst({
        where: { documentId },
        orderBy: { numero: 'desc' },
      });
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
        ...(dto.titre !== undefined && { titre: dto.titre.trim() }),
        ...(dto.contenu !== undefined && { contenu: dto.contenu }),
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });

    if (dto.contenu !== undefined) {
      // Re-index in background — fire and forget
      this.aiService.indexDocument(updated.id).catch(console.error);

      const editor = await this.prisma.utilisateur.findUnique({
        where: { id: userId },
        select: { nom: true },
      });
      await this.notifyWorkspaceMembers(
        doc.workspaceId,
        userId,
        'DOCUMENT_MODIFIE',
        `${editor?.nom ?? 'Un membre'} a modifié le document "${doc.titre}".`,
        `/workspace/${doc.workspaceId}/documents/${documentId}`,
      );
    }

    const favori = await this.prisma.documentFavori.findUnique({
      where: {
        utilisateurId_documentId: { utilisateurId: userId, documentId },
      },
    });
    return { ...updated, isFavori: !!favori };
  }

  // ── Silent update ────────────────────────────────────────────────────────
  //
  // Used by:
  //   • Editor autosave (content only, no title change)
  //   • Template content injection after create()
  //
  // NEVER throws 409: if a title is provided it goes through resolveUniqueTitle
  // so duplicates are silently suffixed.  This is intentional — by the time
  // updateSilent is called the document already exists (create() ran first),
  // so the only scenario where a title conflict could occur is a race condition
  // with another user creating the same template simultaneously.

  async updateSilent(
    userId: string,
    documentId: string,
    data: { titre?: string; contenu?: any },
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        dossierId: true,
        titre: true,
      },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkRole(userId, doc.workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    // Auto-rename if title changed and new name conflicts
    let titre = data.titre?.trim();
    if (titre !== undefined && titre !== doc.titre) {
      titre = await this.resolveUniqueTitle(
        doc.workspaceId,
        doc.dossierId,
        titre,
        documentId,
      );
    }

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        ...(titre !== undefined && { titre }),
        ...(data.contenu !== undefined && { contenu: data.contenu }),
      },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async remove(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true, titre: true },
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

  // ── Versions ─────────────────────────────────────────────────────────────

  async getVersions(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspaceId: true },
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

  async restoreVersion(
    userId: string,
    documentId: string,
    versionId: string,
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

    const version = await this.prisma.versionDocument.findFirst({
      where: { id: versionId, documentId },
    });
    if (!version) throw new NotFoundException('Version introuvable.');

    // Snapshot current content before overwriting
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

  // ── Dashboard helpers ────────────────────────────────────────────────────

  async getRecentAcrossWorkspaces(userId: string) {
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const docs = await this.prisma.document.findMany({
      where: { workspaceId: { in: workspaceIds }, estArchive: false },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        workspace: { select: { id: true, nom: true } },
      },
      orderBy: { dateMiseAJour: 'desc' },
      take: 5,
    });

    return this.attachFavori(docs, userId);
  }

  async getFavoris(userId: string) {
    const favoris = await this.prisma.documentFavori.findMany({
      where: { utilisateurId: userId },
      include: {
        document: {
          include: {
            author: { select: { id: true, nom: true, avatarUrl: true } },
            workspace: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { dateAjout: 'desc' },
      take: 5,
    });

    return favoris
      .filter((f) => !f.document.estArchive)
      .map((f) => ({ ...f.document, isFavori: true }));
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
      this.prisma.documentFavori.count({
        where: {
          utilisateurId: userId,
          document: {
            workspaceId: { in: workspaceIds },
            estArchive: false,
          },
        },
      }),
    ]);

    return { totalDocuments, totalFavoris };
  }

  // ── Move ─────────────────────────────────────────────────────────────────

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

    if (dossierId) {
      const dossier = await this.prisma.dossier.findFirst({
        where: { id: dossierId, workspaceId: doc.workspaceId },
        select: { id: true },
      });
      if (!dossier) throw new NotFoundException('Dossier introuvable.');
    }

    // Auto-rename if a document with the same name already exists in the target
    const titre = await this.resolveUniqueTitle(
      doc.workspaceId,
      dossierId,
      doc.titre,
      documentId,
    );

    return this.prisma.document.update({
      where: { id: documentId },
      data: { dossierId: dossierId ?? null, titre },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async checkMember(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');
    return membre;
  }

  private async checkRole(
    userId: string,
    workspaceId: string,
    roles: Role[],
  ) {
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
}