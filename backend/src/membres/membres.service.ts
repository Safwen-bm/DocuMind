import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class MembresService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, workspaceId: string) {
    await this.checkMember(userId, workspaceId);

    return this.prisma.membreWorkspace.findMany({
      where: { workspaceId },
      include: {
        utilisateur: {
          select: { id: true, nom: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { dateAdhesion: 'asc' },
    });
  }

  async updateRole(
    requesterId: string,
    workspaceId: string,
    targetUserId: string,
    role: Role,
  ) {
    const requester = await this.checkRole(requesterId, workspaceId, [
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    if (targetUserId === requesterId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle.');
    }

    const target = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: targetUserId,
          workspaceId,
        },
      },
    });

    if (!target) throw new NotFoundException('Membre introuvable.');

    // Admin can't change role of PROPRIETAIRE or another ADMINISTRATEUR
    if (
      requester.role === Role.ADMINISTRATEUR &&
      (target.role === Role.PROPRIETAIRE ||
        target.role === Role.ADMINISTRATEUR)
    ) {
      throw new ForbiddenException('Permission insuffisante.');
    }

    // Nobody can assign PROPRIETAIRE role
    if (role === Role.PROPRIETAIRE) {
      throw new ForbiddenException('Impossible d\'assigner le rôle PROPRIETAIRE.');
    }

    return this.prisma.membreWorkspace.update({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: targetUserId,
          workspaceId,
        },
      },
      data: { role },
      include: {
        utilisateur: {
          select: { id: true, nom: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async remove(
    requesterId: string,
    workspaceId: string,
    targetUserId: string,
  ) {
    await this.checkRole(requesterId, workspaceId, [
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const target = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: targetUserId,
          workspaceId,
        },
      },
    });

    if (!target) throw new NotFoundException('Membre introuvable.');

    if (target.role === Role.PROPRIETAIRE) {
      throw new ForbiddenException('Impossible de retirer le propriétaire.');
    }

    await this.prisma.membreWorkspace.delete({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: targetUserId,
          workspaceId,
        },
      },
    });

    return { message: 'Membre retiré.' };
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

  private async checkRole(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[],
  ) {
    const membre = await this.checkMember(userId, workspaceId);
    const hierarchy = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];
    const hasRole = allowedRoles.some(
      (r) => hierarchy.indexOf(membre.role) >= hierarchy.indexOf(r),
    );
    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');
    return membre;
  }
}