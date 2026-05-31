//C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\notifications\notifications.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    // Injected lazily to avoid circular deps — see note below
    private gateway: NotificationsGateway,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    message: string;
    workspaceId?: string;
    lien?: string;
  }) {
    // 1. Save to DB as before
    const notification = await this.prisma.notification.create({ data });

    // 2. Push to user in real time — fire and forget, never throws
    try {
      this.gateway.pushToUser(data.userId, notification);
    } catch { /* socket may not be connected — that's fine */ }

    return notification;
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { dateCreation: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, lu: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { lu: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, lu: false },
      data: { lu: true },
    });
    return { message: 'Toutes les notifications marquées comme lues.' };
  }
}