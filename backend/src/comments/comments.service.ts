// src/comments/comments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Helper: extract @mentions from comment text ────────────────────────────
  // Matches @Jean, @Jean-Pierre, @jean.dupont — stops at space/punctuation
  private extractMentions(text: string): string[] {
    const matches = text.match(/@([\w.\-]+)/g) ?? [];
    // Return unique names without the @ prefix, lowercased for comparison
    return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  }

  // ── 1. Get all comments for a document ─────────────────────────────────────
  async findAll(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { workspaceId: true },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: doc.workspaceId,
        },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    return this.prisma.commentaire.findMany({
      where: { documentId },
      orderBy: { dateCreation: 'asc' },
      include: {
        auteur: { select: { id: true, nom: true, avatarUrl: true } },
      },
    });
  }

  // ── 2. Create a comment + notify doc author + notify @mentions ─────────────
  async create(userId: string, documentId: string, dto: CreateCommentDto) {
    if (!dto.contenu || dto.contenu.trim().length === 0) {
      throw new BadRequestException('Le commentaire ne peut pas être vide.');
    }

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { workspaceId: true, titre: true, authorId: true },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: doc.workspaceId,
        },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    // Persist the comment
    const comment = await this.prisma.commentaire.create({
      data: {
        contenu: dto.contenu.trim(),
        documentId,
        auteurId: userId,
      },
      include: {
        auteur: { select: { id: true, nom: true, avatarUrl: true } },
      },
    });

    const docLink = `/workspace/${doc.workspaceId}/documents/${documentId}`;

    // ── Notify doc author (unless they commented on their own doc) ────────────
    if (doc.authorId !== userId) {
      await this.notifications.create({
        userId: doc.authorId,
        type: 'COMMENTAIRE',
        message: `${comment.auteur.nom} a commenté votre document "${doc.titre}".`,
        workspaceId: doc.workspaceId,
        lien: docLink,
      });
    }

    // ── Detect @mentions and notify each mentioned workspace member ───────────
    const mentionedNames = this.extractMentions(dto.contenu);

    if (mentionedNames.length > 0) {
      // Get all members of the workspace with their user info
      const workspaceMembers = await this.prisma.membreWorkspace.findMany({
        where: { workspaceId: doc.workspaceId },
        include: {
          utilisateur: { select: { id: true, nom: true } },
        },
      });

      // Track who we already notified to avoid duplicates
      const alreadyNotified = new Set<string>([userId]); // never self-notify

      for (const mentionedName of mentionedNames) {
        // Find workspace member whose name matches (case-insensitive)
        const match = workspaceMembers.find((m) =>
          m.utilisateur.nom.toLowerCase().includes(mentionedName),
        );

        if (match && !alreadyNotified.has(match.utilisateurId)) {
          alreadyNotified.add(match.utilisateurId);

          await this.notifications.create({
            userId: match.utilisateurId,
            type: 'MENTION',
            message: `${comment.auteur.nom} vous a mentionné dans un commentaire sur "${doc.titre}".`,
            workspaceId: doc.workspaceId,
            lien: docLink,
          });
        }
      }
    }

    return comment;
  }

  // ── 3. Update a comment (author only) ──────────────────────────────────────
  async update(userId: string, commentId: string, dto: CreateCommentDto) {
    if (!dto.contenu || dto.contenu.trim().length === 0) {
      throw new BadRequestException('Le commentaire ne peut pas être vide.');
    }

    const comment = await this.prisma.commentaire.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');
    if (comment.auteurId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres commentaires.',
      );
    }

    return this.prisma.commentaire.update({
      where: { id: commentId },
      data: { contenu: dto.contenu.trim() },
      include: {
        auteur: { select: { id: true, nom: true, avatarUrl: true } },
      },
    });
  }

  // ── 4. Toggle resolved (any workspace member) ──────────────────────────────
  async toggleResolu(userId: string, commentId: string) {
    const comment = await this.prisma.commentaire.findUnique({
      where: { id: commentId },
      include: { document: { select: { workspaceId: true } } },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: comment.document.workspaceId,
        },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    return this.prisma.commentaire.update({
      where: { id: commentId },
      data: { estResolu: !comment.estResolu },
      include: {
        auteur: { select: { id: true, nom: true, avatarUrl: true } },
      },
    });
  }

  // ── 5. Delete (author OR admin/owner) ──────────────────────────────────────
  async remove(userId: string, commentId: string) {
    const comment = await this.prisma.commentaire.findUnique({
      where: { id: commentId },
      include: { document: { select: { workspaceId: true } } },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: {
          utilisateurId: userId,
          workspaceId: comment.document.workspaceId,
        },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const isAuthor = comment.auteurId === userId;
    const isAdmin = ['ADMINISTRATEUR', 'PROPRIETAIRE'].includes(membre.role);
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres commentaires.',
      );
    }

    await this.prisma.commentaire.delete({ where: { id: commentId } });
    return { deleted: true };
  }
}