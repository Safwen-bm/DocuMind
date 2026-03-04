import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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

    const dossier = await this.prisma.dossier.create({
      data: {
        nom: dto.nom,
        workspaceId,
        parentId: dto.parentId ?? null,
        createdById: userId,
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

  async findAll(userId: string, workspaceId: string) {
    await this.checkMember(userId, workspaceId);

    const dossiers = await this.prisma.dossier.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { documents: true, enfants: true } },
      },
      orderBy: { nom: 'asc' },
    });

    return dossiers;
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
    });
  }

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