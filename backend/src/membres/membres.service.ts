// backend/src/membres/membres.service.ts

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
    private notifications: NotificationsService,
  ) {}

  // ── findAll ──────────────────────────────────────────────────────────────
  // Returns ALL members (active + removed) ordered by:
  //   1. removed last  2. role hierarchy  3. join date
  async findAll(userId: string, workspaceId: string) {
    // Caller must be a member (active) to see this list
    await this.checkActiveMember(userId, workspaceId);

    return this.prisma.membreWorkspace.findMany({
      where: { workspaceId },
      include: {
        utilisateur: {
          select: { id: true, nom: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [
        { estRetire: 'asc' },      // active members first
        { dateAdhesion: 'asc' },   // then by join date
      ],
    });
  }

  // ── updateRole ───────────────────────────────────────────────────────────
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

    // Cannot update a removed member
    if (target.estRetire) {
      throw new BadRequestException(
        'Impossible de modifier le rôle d\'un membre retiré.',
      );
    }

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

  // ── remove ───────────────────────────────────────────────────────────────
  // Soft delete: sets estRetire = true and dateRetrait = now()
  // The record stays in the DB — no data is lost
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

    // Already removed — idempotent, just return success
    if (target.estRetire) {
      return { message: 'Membre déjà retiré.' };
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { nom: true },
    });

    // ── Soft delete: update instead of delete ─────────────────────────────
    await this.prisma.membreWorkspace.update({
      where: {
        utilisateurId_workspaceId: { utilisateurId: targetUserId, workspaceId },
      },
      data: {
        estRetire: true,
        dateRetrait: new Date(),
      },
    });

    await this.notifications.create({
      userId: targetUserId,
      type: 'MEMBRE_RETIRE',
      message: `Vous avez été retiré du workspace "${workspace?.nom}".`,
      workspaceId: undefined,
      lien: undefined,
    });

    return { message: 'Membre retiré.' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  // Only active (non-removed) members can perform actions
  private async checkActiveMember(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre || membre.estRetire) {
      throw new NotFoundException('Workspace introuvable.');
    }
    return membre;
  }

  private async checkRole(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[],
  ) {
    const membre = await this.checkActiveMember(userId, workspaceId);
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