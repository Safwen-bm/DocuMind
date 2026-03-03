import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { Role } from '@prisma/client';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        nom: dto.nom,
        description: dto.description,
        proprietaireId: userId,
        membres: {
          create: {
            utilisateurId: userId,
            role: Role.PROPRIETAIRE,
          },
        },
      },
      include: { membres: true },
    });
    return workspace;
  }

  async findAll(userId: string) {
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId },
      include: {
        workspace: {
          include: {
            _count: { select: { membres: true } },
          },
        },
      },
      orderBy: { workspace: { dateMiseAJour: 'desc' } },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      monRole: m.role,
    }));
  }

  async findOne(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId,
        },
      },
      include: {
        workspace: {
          include: {
            _count: { select: { membres: true } },
          },
        },
      },
    });

    if (!membre) throw new NotFoundException('Workspace introuvable.');

    return { ...membre.workspace, monRole: membre.role };
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.checkRole(userId, workspaceId, [
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  async remove(userId: string, workspaceId: string) {
    await this.checkRole(userId, workspaceId, [Role.PROPRIETAIRE]);

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { message: 'Workspace supprimé.' };
  }

  private async checkRole(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[],
  ) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId,
        },
      },
    });

    if (!membre) throw new NotFoundException('Workspace introuvable.');

    const roleHierarchy = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];

    const userIndex = roleHierarchy.indexOf(membre.role);
    const hasRole = allowedRoles.some(
      (r) => userIndex >= roleHierarchy.indexOf(r),
    );

    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');
  }
}