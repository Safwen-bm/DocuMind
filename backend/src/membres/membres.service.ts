// src/membres/membres.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '@prisma/client';

@Injectable()
export class MembresService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService, // ← inject
  ) {}

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
      throw new BadRequestException(
        'Vous ne pouvez pas modifier votre propre rôle.',
      );
    }

    const target = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: targetUserId, workspaceId },
      },
      include: {
        utilisateur: { select: { id: true, nom: true } },
      },
    });
    if (!target) throw new NotFoundException('Membre introuvable.');

    if (
      requester.role === Role.ADMINISTRATEUR &&
      (target.role === Role.PROPRIETAIRE || target.role === Role.ADMINISTRATEUR)
    ) {
      throw new ForbiddenException('Permission insuffisante.');
    }

    if (role === Role.PROPRIETAIRE) {
      throw new ForbiddenException(
        "Impossible d'assigner le rôle PROPRIETAIRE.",
      );
    }

    // Get workspace name for the notification message
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { nom: true },
    });

    const updated = await this.prisma.membreWorkspace.update({
      where: {
        utilisateurId_workspaceId: { utilisateurId: targetUserId, workspaceId },
      },
      data: { role },
      include: {
        utilisateur: {
          select: { id: true, nom: true, email: true, avatarUrl: true },
        },
      },
    });

    // ── Notify the member whose role was changed ────────────────────────────
    const roleLabels: Record<string, string> = {
      LECTEUR: 'Lecteur',
      EDITEUR: 'Éditeur',
      ADMINISTRATEUR: 'Administrateur',
    };
    await this.notifications.create({
      userId: targetUserId,
      type: 'ROLE_MODIFIE',
      message: `Votre rôle dans le workspace "${workspace?.nom}" a été changé en ${roleLabels[role] ?? role}.`,
      workspaceId,
      lien: `/workspace/${workspaceId}`,
    });

    return updated;
  }

  async remove(requesterId: string, workspaceId: string, targetUserId: string) {
    await this.checkRole(requesterId, workspaceId, [
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const target = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: targetUserId, workspaceId },
      },
      include: {
        utilisateur: { select: { id: true, nom: true } },
      },
    });
    if (!target) throw new NotFoundException('Membre introuvable.');

    if (target.role === Role.PROPRIETAIRE) {
      throw new ForbiddenException('Impossible de retirer le propriétaire.');
    }

    // Get workspace name before deleting
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { nom: true },
    });

    await this.prisma.membreWorkspace.delete({
      where: {
        utilisateurId_workspaceId: { utilisateurId: targetUserId, workspaceId },
      },
    });

    // ── Notify the removed member ───────────────────────────────────────────
    // Note: no lien since they no longer have access to this workspace
    await this.notifications.create({
      userId: targetUserId,
      type: 'MEMBRE_RETIRE',
      message: `Vous avez été retiré du workspace "${workspace?.nom}".`,
      workspaceId: undefined, // don't link to workspace they can't access anymore
      lien: undefined,
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