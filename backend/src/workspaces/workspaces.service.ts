// backend/src/workspaces/workspaces.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { Prisma, Role } from '@prisma/client';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private plans: PlansService,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateWorkspaceDto) {
    await this.plans.assertCanCreateWorkspace(userId);
    const existing = await this.prisma.workspace.findFirst({
      where: { proprietaireId: userId, nom: dto.nom },
    });
    if (existing) {
      throw new ConflictException(
        `Vous avez déjà un workspace nommé "${dto.nom}". Choisissez un autre nom.`,
      );
    }

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

  // ── Read ────────────────────────────────────────────────────────────────────

  async findAll(userId: string) {
    // Only return workspaces where the user is an ACTIVE member
    const memberships = await this.prisma.membreWorkspace.findMany({
      where: { utilisateurId: userId, estRetire: false }, // ← fix
      include: {
        workspace: {
          include: {
            _count: { select: { membres: true } },
            proprietaire: {
              select: { id: true, nom: true, avatarUrl: true },
            },
            subscription: {
              select: { plan: true, status: true },
            },
          },
        },
      },
      orderBy: { workspace: { dateMiseAJour: 'desc' } },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      monRole: m.role,
      isOwner: m.workspace.proprietaireId === userId,
      plan:
        m.workspace.subscription?.status === 'active'
          ? m.workspace.subscription.plan
          : 'FREE',
    }));
  }

  async findOne(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
      include: {
        workspace: {
          include: {
            _count: { select: { membres: true } },
            proprietaire: {
              select: { id: true, nom: true, avatarUrl: true },
            },
            subscription: {
              select: { plan: true, status: true },
            },
          },
        },
      },
    });

    // Block removed members from accessing the workspace
    if (!membre || membre.estRetire) // ← fix
      throw new NotFoundException('Workspace introuvable.');

    return {
      ...membre.workspace,
      monRole: membre.role,
      isOwner: membre.workspace.proprietaireId === userId,
      plan:
        membre.workspace.subscription?.status === 'active'
          ? membre.workspace.subscription.plan
          : 'FREE',
    };
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.checkRole(userId, workspaceId, [
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    if (dto.nom) {
      const conflict = await this.prisma.workspace.findFirst({
        where: {
          proprietaireId: userId,
          nom: dto.nom,
          id: { not: workspaceId },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Vous avez déjà un workspace nommé "${dto.nom}". Choisissez un autre nom.`,
        );
      }
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async remove(userId: string, workspaceId: string) {
    await this.checkRole(userId, workspaceId, [Role.PROPRIETAIRE]);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { message: 'Workspace supprimé.' };
  }

  // ── Activity ────────────────────────────────────────────────────────────────

  async getActivity(userId: string, workspaceId: string) {
    await this.checkRole(userId, workspaceId, [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    return this.prisma.activite.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, nom: true, avatarUrl: true } },
      },
      orderBy: { dateCreation: 'desc' },
      take: 20,
    });
  }

  // ── Analytics ────────────────────────────────────────────────────────────────

  async getAnalytics(userId: string, workspaceId: string) {
    await this.checkRole(userId, workspaceId, [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ]);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalDocuments = await this.prisma.document.count({
      where: { workspaceId },
    });
    const documentsThisWeek = await this.prisma.document.count({
      where: { workspaceId, dateCreation: { gte: sevenDaysAgo } },
    });

    // Only count ACTIVE members
    const totalMembers = await this.prisma.membreWorkspace.count({
      where: { workspaceId, estRetire: false }, // ← fix
    });

    const aiQuestions = await this.prisma.messageIA.count({
      where: { role: 'UTILISATEUR', conversation: { workspaceId } },
    });
    const aiQuestionsThisWeek = await this.prisma.messageIA.count({
      where: {
        role: 'UTILISATEUR',
        dateCreation: { gte: sevenDaysAgo },
        conversation: { workspaceId },
      },
    });

    const docsPerDay = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT TO_CHAR(DATE_TRUNC('day', "dateCreation"), 'YYYY-MM-DD') as date, COUNT(*) as count
      FROM "documents"
      WHERE "workspaceId" = ${workspaceId} AND "dateCreation" >= ${sevenDaysAgo}
      GROUP BY DATE_TRUNC('day', "dateCreation")
      ORDER BY DATE_TRUNC('day', "dateCreation") ASC
    `;

    const activityPerDay = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT TO_CHAR(DATE_TRUNC('day', "dateCreation"), 'YYYY-MM-DD') as date, COUNT(*) as count
      FROM "activites"
      WHERE "workspaceId" = ${workspaceId} AND "dateCreation" >= ${sevenDaysAgo}
      GROUP BY DATE_TRUNC('day', "dateCreation")
      ORDER BY DATE_TRUNC('day', "dateCreation") ASC
    `;

    const topMembers = await this.prisma.activite.groupBy({
      by: ['userId'],
      where: { workspaceId, dateCreation: { gte: thirtyDaysAgo } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    const topMembersWithInfo = await Promise.all(
      topMembers.map(async (m) => {
        const user = await this.prisma.utilisateur.findUnique({
          where: { id: m.userId },
          select: { id: true, nom: true, avatarUrl: true },
        });
        return { user, count: m._count.userId };
      }),
    );

    const actionBreakdown = await this.prisma.activite.groupBy({
      by: ['action'],
      where: { workspaceId, dateCreation: { gte: thirtyDaysAgo } },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const docsChart = last7Days.map((date) => ({
      date,
      documents: Number(docsPerDay.find((d) => d.date === date)?.count ?? 0),
    }));

    const activityChart = last7Days.map((date) => ({
      date,
      actions: Number(activityPerDay.find((d) => d.date === date)?.count ?? 0),
    }));

    return {
      totals: {
        documents: totalDocuments,
        documentsThisWeek,
        members: totalMembers,
        aiQuestions,
        aiQuestionsThisWeek,
      },
      docsChart,
      activityChart,
      topMembers: topMembersWithInfo,
      actionBreakdown: actionBreakdown.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async checkRole(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[],
  ) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });

    // Block removed members — treat as if workspace doesn't exist
    if (!membre || membre.estRetire) // ← fix
      throw new NotFoundException('Workspace introuvable.');

    const hierarchy = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];
    const userIndex = hierarchy.indexOf(membre.role);
    const hasRole = allowedRoles.some((r) => userIndex >= hierarchy.indexOf(r));
    if (!hasRole) throw new ForbiddenException('Permission insuffisante.');
  }

  // ── Members for filter dropdown ──────────────────────────────────────────────

  async getMembersForFilter(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });

    // Block removed members
    if (!membre || membre.estRetire) // ← fix
      throw new NotFoundException('Workspace introuvable.');

    const roleHierarchy = [
      'LECTEUR',
      'EDITEUR',
      'ADMINISTRATEUR',
      'PROPRIETAIRE',
    ];
    if (
      roleHierarchy.indexOf(membre.role) <
      roleHierarchy.indexOf('ADMINISTRATEUR')
    ) {
      throw new ForbiddenException('Permission insuffisante.');
    }

    // Only return active members in the filter dropdown
    return this.prisma.membreWorkspace.findMany({
      where: { workspaceId, estRetire: false }, // ← fix
      select: {
        utilisateur: {
          select: { id: true, nom: true, email: true, avatarUrl: true },
        },
        role: true,
      },
      orderBy: { utilisateur: { nom: 'asc' } },
    });
  }
}