// src/share/share.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

export type SharePermission = 'READ' | 'EDIT';

@Injectable()
export class ShareService {
  constructor(private prisma: PrismaService) {}

  // ── Create a share link ───────────────────────────────────────────────
  async createShareLink(
    userId: string,
    documentId: string,
    permission: SharePermission = 'READ',
    expiresInDays?: number,
  ): Promise<{
    token: string;
    url: string;
    permission: SharePermission;
    expiresAt: Date | null;
  }> {
    // Verify doc exists and user has access
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');

    await this.checkEditorRole(userId, doc.workspaceId);

    // Revoke any existing share for this doc by this user with same permission
    await this.prisma.shareToken.deleteMany({
      where: { documentId, createdById: userId, permission },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await this.prisma.shareToken.create({
      data: {
        token,
        documentId,
        createdById: userId,
        permission,
        expiresAt,
      },
    });

    return {
      token,
      url: `${process.env.FRONTEND_URL}/share/${token}`,
      permission,
      expiresAt,
    };
  }

  // ── Get all share links for a document ───────────────────────────────
  async getShareLinks(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkEditorRole(userId, doc.workspaceId);

    return this.prisma.shareToken.findMany({
      where: { documentId },
      orderBy: { dateCreation: 'desc' },
    });
  }

  // ── Revoke a share link ───────────────────────────────────────────────
  async revokeShareLink(userId: string, tokenId: string) {
    const shareToken = await this.prisma.shareToken.findUnique({
      where: { id: tokenId },
      include: { document: true },
    });
    if (!shareToken) throw new NotFoundException('Lien introuvable.');
    await this.checkEditorRole(userId, shareToken.document.workspaceId);

    await this.prisma.shareToken.delete({ where: { id: tokenId } });
    return { deleted: true };
  }

  // ── Resolve a share token → return document (public, no auth needed) ──
  async resolveToken(token: string) {
    const shareToken = await this.prisma.shareToken.findUnique({
      where: { token },
      include: {
        document: {
          include: {
            author: { select: { id: true, nom: true, avatarUrl: true } },
            workspace: { select: { id: true, nom: true } },
            dossier: { select: { id: true, nom: true } },
          },
        },
      },
    });

    if (!shareToken) throw new NotFoundException('Lien de partage invalide.');

    // Check expiry
    if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
      throw new GoneException('Ce lien de partage a expiré.');
    }

    if (shareToken.document.estArchive) {
      throw new NotFoundException("Ce document n'est plus disponible.");
    }

    return {
      document: shareToken.document,
      permission: shareToken.permission,
      expiresAt: shareToken.expiresAt,
    };
  }

  private async checkEditorRole(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');
    const canShare = [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ] as string[];
    if (!canShare.includes(membre.role)) {
      throw new ForbiddenException('Permission insuffisante pour partager.');
    }
  }
}
