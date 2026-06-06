// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\activite\activite.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionType, Prisma } from '@prisma/client';

export interface AdminLogsQuery {
  page?: number;
  limit?: number;
  action?: ActionType;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminLogsResult {
  logs: {
    id: string;
    action: ActionType;
    cible: string;
    cibleId: string | null;
    dateCreation: Date;
    user: { id: string; nom: string; avatarUrl: string | null; email: string };
  }[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class ActiviteService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    workspaceId: string;
    userId: string;
    action: ActionType;
    cible: string;
    cibleId?: string;
  }) {
    await this.prisma.activite.create({ data });
  }

  async findByWorkspace(workspaceId: string, limit = 20) {
    return this.prisma.activite.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, nom: true, avatarUrl: true },
        },
      },
      orderBy: { dateCreation: 'desc' },
      take: limit,
    });
  }

  // ── Admin Logs: paginated, filtered, searchable ─────────────────────────────
  async getAdminLogs(
    workspaceId: string,
    query: AdminLogsQuery,
  ): Promise<AdminLogsResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.ActiviteWhereInput = { workspaceId };

    if (query.action) {
      where.action = query.action;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        // Include the full end day
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.dateCreation = dateFilter;
    }

    // Search on cible (target name / document title)
    if (query.search && query.search.trim()) {
      where.cible = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const [logs, total] = await Promise.all([
      this.prisma.activite.findMany({
        where,
        include: {
          user: {
            select: { id: true, nom: true, avatarUrl: true, email: true },
          },
        },
        orderBy: { dateCreation: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activite.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Stats summary for the admin logs header ─────────────────────────────────
  async getAdminLogsSummary(workspaceId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, last24hCount, last7dCount, byAction, activeUsers] =
      await Promise.all([
        this.prisma.activite.count({ where: { workspaceId } }),
        this.prisma.activite.count({
          where: { workspaceId, dateCreation: { gte: last24h } },
        }),
        this.prisma.activite.count({
          where: { workspaceId, dateCreation: { gte: last7d } },
        }),
        this.prisma.activite.groupBy({
          by: ['action'],
          where: { workspaceId, dateCreation: { gte: last7d } },
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
        }),
        this.prisma.activite.groupBy({
          by: ['userId'],
          where: { workspaceId, dateCreation: { gte: last7d } },
          _count: { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 5,
        }),
      ]);

    return {
      total,
      last24h: last24hCount,
      last7d: last7dCount,
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
      activeUserCount: activeUsers.length,
    };
  }
}