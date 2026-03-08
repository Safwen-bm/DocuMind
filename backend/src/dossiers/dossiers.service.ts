import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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

  // Returns a flat list — frontend builds the tree
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

    return this.prisma.dossier.update({
      where: { id: dossierId },
      data: { nom: dto.nom },
      include: { _count: { select: { documents: true, enfants: true } } },
    });
  }

  // Move a folder to a new parent (or root if parentId is null)
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

    // Can't move a folder into itself
    if (parentId === dossierId) {
      throw new BadRequestException('Un dossier ne peut pas être son propre parent.');
    }

    // Can't move into a descendant
    if (parentId) {
      const isDescendant = await this.isDescendant(dossierId, parentId);
      if (isDescendant) {
        throw new BadRequestException(
          'Impossible de déplacer un dossier dans l\'un de ses sous-dossiers.',
        );
      }

      // Validate new parent belongs to same workspace
      const newParent = await this.prisma.dossier.findFirst({
        where: { id: parentId, workspaceId },
      });
      if (!newParent) throw new NotFoundException('Dossier parent introuvable.');
    }

    return this.prisma.dossier.update({
      where: { id: dossierId },
      data: { parentId: parentId ?? null },
      include: { _count: { select: { documents: true, enfants: true } } },
    });
  }

  // Recursive delete: deletes folder + all subfolder descendants + their documents
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

    // Prisma cascade (onDelete: Cascade on enfants relation) handles recursive deletion
    // Documents with dossierId pointing here get SetNull (they stay, just unassigned)
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

  // Get contents of a specific folder (direct children only)
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

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Check if targetId is a descendant of ancestorId
  private async isDescendant(
    ancestorId: string,
    targetId: string,
  ): Promise<boolean> {
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
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new NotFoundException('Workspace introuvable.');
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
}