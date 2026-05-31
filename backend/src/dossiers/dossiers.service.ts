// backend/src/dossiers/dossiers.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from '../activite/activite.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { ActionType, Role } from '@prisma/client';

@Injectable()
export class DossiersService {
  constructor(
    private prisma: PrismaService,
    private activite: ActiviteService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, workspaceId: string, dto: CreateDossierDto) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    // Validate parentId belongs to same workspace
    if (dto.parentId) {
      const parent = await this.prisma.dossier.findFirst({
        where: { id: dto.parentId, workspaceId },
      });
      if (!parent) throw new NotFoundException('Dossier parent introuvable.');
    }

    // Check for duplicate name in the same parent (or root)
    await this.assertNameAvailable(workspaceId, dto.parentId ?? null, dto.nom);

    const dossier = await this.prisma.dossier.create({
      data: {
        nom: dto.nom,
        workspaceId,
        parentId: dto.parentId ?? null,
        createdById: userId,
      },
      include: {
        _count: { select: { documents: true, enfants: true } },
      },
    });

    await this.activite.log({
      workspaceId,
      userId,
      action: ActionType.DOSSIER_CREE,
      cible: dto.nom,
      cibleId: dossier.id,
    });

    return dossier;
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async findAll(userId: string, workspaceId: string) {
    await this.checkMember(userId, workspaceId);

    return this.prisma.dossier.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { documents: true, enfants: true } },
      },
      orderBy: { nom: 'asc' },
    });
  }

  // ── Update (rename) ──────────────────────────────────────────────────────────

  async update(
    userId: string,
    workspaceId: string,
    dossierId: string,
    dto: UpdateDossierDto,
  ) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const dossier = await this.prisma.dossier.findFirst({
      where: { id: dossierId, workspaceId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');

    // Only check if the name is actually changing
    if (dto.nom !== dossier.nom) {
      await this.assertNameAvailable(
        workspaceId,
        dossier.parentId,
        dto.nom,
        dossierId, // exclude self
      );
    }

    return this.prisma.dossier.update({
      where: { id: dossierId },
      data: { nom: dto.nom },
      include: { _count: { select: { documents: true, enfants: true } } },
    });
  }

  // ── Move ─────────────────────────────────────────────────────────────────────

  async move(
    userId: string,
    workspaceId: string,
    dossierId: string,
    parentId: string | null,
  ) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const dossier = await this.prisma.dossier.findFirst({
      where: { id: dossierId, workspaceId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');

    if (parentId === dossierId) {
      throw new BadRequestException('Un dossier ne peut pas être son propre parent.');
    }

    if (parentId) {
      const isDescendant = await this.isDescendant(dossierId, parentId);
      if (isDescendant) {
        throw new BadRequestException(
          "Impossible de déplacer un dossier dans l'un de ses sous-dossiers.",
        );
      }

      const newParent = await this.prisma.dossier.findFirst({
        where: { id: parentId, workspaceId },
      });
      if (!newParent) throw new NotFoundException('Dossier parent introuvable.');
    }

    // Check the folder's name won't conflict in the destination
    await this.assertNameAvailable(workspaceId, parentId, dossier.nom, dossierId);

    return this.prisma.dossier.update({
      where: { id: dossierId },
      data: { parentId: parentId ?? null },
      include: { _count: { select: { documents: true, enfants: true } } },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async remove(userId: string, workspaceId: string, dossierId: string) {
    await this.checkRole(userId, workspaceId, [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const dossier = await this.prisma.dossier.findFirst({
      where: { id: dossierId, workspaceId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');

    await this.prisma.dossier.delete({ where: { id: dossierId } });

    await this.activite.log({
      workspaceId,
      userId,
      action: ActionType.DOSSIER_SUPPRIME,
      cible: dossier.nom,
      cibleId: dossierId,
    });

    return { message: 'Dossier supprimé.' };
  }

  // ── Contents ─────────────────────────────────────────────────────────────────

  async getContents(userId: string, workspaceId: string, dossierId: string) {
    await this.checkMember(userId, workspaceId);

    const dossier = await this.prisma.dossier.findFirst({
      where: { id: dossierId, workspaceId },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');

    const [subfolders, documents] = await Promise.all([
      this.prisma.dossier.findMany({
        where: { parentId: dossierId, workspaceId },
        include: { _count: { select: { documents: true, enfants: true } } },
        orderBy: { nom: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { dossierId, workspaceId, estArchive: false },
        include: {
          author: { select: { id: true, nom: true, avatarUrl: true } },
          dossier: { select: { id: true, nom: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { dateMiseAJour: 'desc' },
      }),
    ]);

    return { dossier, subfolders, documents };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Throws 409 if a folder with the same name already exists in the same
   * parent (or root). Explicit check needed because PostgreSQL treats
   * NULL != NULL in unique indexes, so @@unique([workspaceId, parentId, nom])
   * does NOT protect root-level folders (parentId = null).
   *
   * excludeId: skip this folder when checking (used during rename / move).
   */
  private async assertNameAvailable(
    workspaceId: string,
    parentId: string | null,
    nom: string,
    excludeId?: string,
  ) {
    const conflict = await this.prisma.dossier.findFirst({
      where: {
        workspaceId,
        parentId: parentId ?? null,
        nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (conflict) {
      const location = parentId ? 'dans ce dossier' : 'à la racine du workspace';
      throw new ConflictException(
        `Un dossier nommé "${nom}" existe déjà ${location}. Choisissez un autre nom.`,
      );
    }
  }

  private async isDescendant(ancestorId: string, targetId: string): Promise<boolean> {
    const children = await this.prisma.dossier.findMany({
      where: { parentId: ancestorId },
      select: { id: true },
    });
    for (const child of children) {
      if (child.id === targetId) return true;
      if (await this.isDescendant(child.id, targetId)) return true;
    }
    return false;
  }

  private async checkMember(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new NotFoundException('Workspace introuvable.');
    return membre;
  }

  private async checkRole(userId: string, workspaceId: string, roles: Role[]) {
    const membre = await this.checkMember(userId, workspaceId);
    const hierarchy = [Role.LECTEUR, Role.EDITEUR, Role.ADMINISTRATEUR, Role.PROPRIETAIRE];
    const hasRole = roles.some(
      (r) => hierarchy.indexOf(membre.role) >= hierarchy.indexOf(r),
    );
    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');
  }
}