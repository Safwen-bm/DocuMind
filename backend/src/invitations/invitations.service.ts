import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async invite(
    requesterId: string,
    workspaceId: string,
    dto: CreateInvitationDto,
  ) {
    // Check requester is at least ADMINISTRATEUR
    const requester = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: requesterId,
          workspaceId,
        },
      },
      include: { workspace: true },
    });

    if (!requester) throw new NotFoundException('Workspace introuvable.');

    const hierarchy = [
      Role.LECTEUR,
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];
    if (hierarchy.indexOf(requester.role) < hierarchy.indexOf(Role.ADMINISTRATEUR)) {
      throw new ForbiddenException('Permission insuffisante.');
    }

    // Check if user is already a member
    const existingUser = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const alreadyMember = await this.prisma.membreWorkspace.findUnique({
        where: {
          utilisateurId_workspaceId: {
            utilisateurId: existingUser.id,
            workspaceId,
          },
        },
      });
      if (alreadyMember) {
        throw new BadRequestException('Cet utilisateur est déjà membre.');
      }
    }

    // Delete any existing pending invitation for this email+workspace
    await this.prisma.invitation.deleteMany({
      where: { email: dto.email, workspaceId },
    });

    const token = uuidv4();
    const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.invitation.create({
      data: {
        email: dto.email,
        workspaceId,
        token,
        role: dto.role ?? Role.LECTEUR,
        expiration,
      },
    });

    // Send invitation email
    await this.mailService.sendInvitationEmail(
      dto.email,
      requester.workspace.nom,
      token,
    );

    return { message: 'Invitation envoyée.' };
  }

  async accept(token: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) throw new NotFoundException('Invitation invalide.');

    if (invitation.expiration < new Date()) {
      await this.prisma.invitation.delete({ where: { token } });
      throw new BadRequestException('Invitation expirée.');
    }

    // Check user email matches invitation email
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException(
        'Cette invitation est destinée à une autre adresse email.',
      );
    }

    // Check not already a member
    const alreadyMember = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: invitation.workspaceId,
        },
      },
    });

    if (alreadyMember) {
      await this.prisma.invitation.delete({ where: { token } });
      return { message: 'Vous êtes déjà membre de ce workspace.' };
    }

    // Add user to workspace
    await this.prisma.membreWorkspace.create({
      data: {
        utilisateurId: userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    await this.prisma.invitation.delete({ where: { token } });

    return {
      message: 'Invitation acceptée.',
      workspaceId: invitation.workspaceId,
    };
  }
}