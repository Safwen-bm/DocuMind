import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Role, NotificationType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private notifications: NotificationsService,
  ) {}

  async invite(
    requesterId: string,
    workspaceId: string,
    dto: CreateInvitationDto,
  ) {
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

    await this.prisma.invitation.deleteMany({
      where: { email: dto.email, workspaceId },
    });

    const token = uuidv4();
    const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.create({
      data: {
        email: dto.email,
        workspaceId,
        token,
        role: dto.role ?? Role.LECTEUR,
        expiration,
      },
    });

    await this.mailService.sendInvitationEmail(
      dto.email,
      requester.workspace.nom,
      token,
    );

    // Notify the invited user if they already have an account
    if (existingUser) {
      await this.notifications.create({
        userId: existingUser.id,
        type: NotificationType.INVITATION,
        message: `You've been invited to join "${requester.workspace.nom}"`,
        workspaceId,
        lien: `/invitations/accept?token=${token}`,
      });
    }

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

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException(
        'Cette invitation est destinée à une autre adresse email.',
      );
    }

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

    await this.prisma.membreWorkspace.create({
      data: {
        utilisateurId: userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    await this.prisma.invitation.delete({ where: { token } });

    // Notify workspace owner that someone joined
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
      select: { proprietaireId: true, nom: true },
    });

    if (workspace && workspace.proprietaireId !== userId) {
      await this.notifications.create({
        userId: workspace.proprietaireId,
        type: NotificationType.MEMBRE_REJOINT,
        message: `${user.nom} joined your workspace "${workspace.nom}"`,
        workspaceId: invitation.workspaceId,
      });
    }

    return {
      message: 'Invitation acceptée.',
      workspaceId: invitation.workspaceId,
    };
  }
}