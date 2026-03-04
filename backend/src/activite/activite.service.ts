import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionType } from '@prisma/client';

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
}