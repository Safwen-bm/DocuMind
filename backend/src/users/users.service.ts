import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';

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

  async updateProfile(
    userId: string,
    data: { nom?: string; avatarUrl?: string },
  ) {
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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(currentPassword, user.motDePasse);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect.');

    if (newPassword.length < 8) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { motDePasse: hashed },
    });

    return { message: 'Mot de passe mis à jour.' };
  }
}
