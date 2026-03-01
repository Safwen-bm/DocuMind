import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nom: true,
        email: true,
        avatarUrl: true,
        dateCreation: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  async updateProfile(userId: string, data: { nom?: string; avatarUrl?: string }) {
    return this.prisma.utilisateur.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nom: true,
        email: true,
        avatarUrl: true,
      },
    });
  }
}