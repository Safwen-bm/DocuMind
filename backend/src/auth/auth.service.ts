// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\auth\auth.service.ts

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  // ── Register ──────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Cet email est déjà utilisé.');
    }

    const hash = await bcrypt.hash(dto.motDePasse, 12);
    const user = await this.prisma.utilisateur.create({
      data: {
        nom: dto.nom,
        email: dto.email,
        motDePasse: hash,
      },
    });

    // Create confirmation token (24h)
    const token = uuidv4();
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.tokenVerification.create({
      data: {
        utilisateurId: user.id,
        token,
        type: 'CONFIRMATION_EMAIL',
        expiration,
      },
    });

    await this.mail.sendConfirmationEmail(user.email, token);

    return {
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
    };
  }

  // ── Confirm Email ─────────────────────────────────────────────
  async confirmEmail(token: string) {
    const record = await this.prisma.tokenVerification.findUnique({
      where: { token },
    });

    if (!record || record.type !== 'CONFIRMATION_EMAIL') {
      throw new BadRequestException('Lien invalide.');
    }
    if (record.expiration < new Date()) {
      throw new BadRequestException('Lien expiré.');
    }

    await this.prisma.utilisateur.update({
      where: { id: record.utilisateurId },
      data: { estActif: true },
    });

    await this.prisma.tokenVerification.delete({ where: { token } });

    return { message: 'Compte activé avec succès.' };
  }

  // ── Login ─────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    // Generic error — never specify if email or password is wrong
    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    // Check account lock
    if (user.verrouillageJusqua && user.verrouillageJusqua > new Date()) {
      throw new ForbiddenException(
        'Compte verrouillé temporairement. Réessayez dans 15 minutes.',
      );
    }

    if (!user.estActif) {
      throw new ForbiddenException(
        'Veuillez confirmer votre email avant de vous connecter.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasse);

    if (!passwordValid) {
      const newCount = user.tentativesEchec + 1;
      const updateData: any = { tentativesEchec: newCount };

      if (newCount >= 5) {
        updateData.verrouillageJusqua = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Identifiants incorrects.');
    }

    // Reset failed attempts
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { tentativesEchec: 0, verrouillageJusqua: null },
    });

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing OTP for this user
    await this.prisma.tokenVerification.deleteMany({
      where: { utilisateurId: user.id, type: 'OTP_2FA' },
    });

    await this.prisma.tokenVerification.create({
      data: {
        utilisateurId: user.id,
        token: otp,
        type: 'OTP_2FA',
        expiration,
      },
    });

    await this.mail.sendOtpEmail(user.email, otp);

    return { message: 'Code OTP envoyé par email.' };
  }

  // ── Verify OTP ────────────────────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    const record = await this.prisma.tokenVerification.findFirst({
      where: { utilisateurId: user.id, type: 'OTP_2FA', token: dto.otp },
    });

    if (!record) {
      throw new UnauthorizedException('Code OTP incorrect.');
    }

    if (record.expiration < new Date()) {
      await this.prisma.tokenVerification.delete({ where: { id: record.id } });
      throw new UnauthorizedException('Code OTP expiré. Reconnectez-vous.');
    }

    await this.prisma.tokenVerification.delete({ where: { id: record.id } });

    // Generate JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // ── Forgot Password ───────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.utilisateur.findUnique({ where: { email } });

    // Always return success — never reveal if email exists
    if (!user) {
      return {
        message:
          'Si cet email existe, un lien de réinitialisation a été envoyé.',
      };
    }

    const token = uuidv4();
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.tokenVerification.deleteMany({
      where: { utilisateurId: user.id, type: 'RESET_MOT_DE_PASSE' },
    });

    await this.prisma.tokenVerification.create({
      data: {
        utilisateurId: user.id,
        token,
        type: 'RESET_MOT_DE_PASSE',
        expiration,
      },
    });

    await this.mail.sendPasswordResetEmail(user.email, token);

    return {
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.',
    };
  }

  // ── Reset Password ────────────────────────────────────────────
  async resetPassword(token: string, nouveauMotDePasse: string) {
    const record = await this.prisma.tokenVerification.findUnique({
      where: { token },
    });

    if (!record || record.type !== 'RESET_MOT_DE_PASSE') {
      throw new BadRequestException('Lien invalide.');
    }
    if (record.expiration < new Date()) {
      throw new BadRequestException('Lien expiré.');
    }

    const hash = await bcrypt.hash(nouveauMotDePasse, 12);
    await this.prisma.utilisateur.update({
      where: { id: record.utilisateurId },
      data: { motDePasse: hash },
    });

    await this.prisma.tokenVerification.delete({ where: { token } });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  // ── Test Login (test/dev only) ────────────────────────────────────────────
  async testLogin(email: string, password: string, nom: string) {
    // Find or create the user
    let user = await this.prisma.utilisateur.findUnique({ where: { email } });

    if (!user) {
      const hash = await bcrypt.hash(password, 12);
      user = await this.prisma.utilisateur.create({
        data: { nom, email, motDePasse: hash, estActif: true },
      });
    } else {
      // Make sure the user is active
      if (!user.estActif) {
        await this.prisma.utilisateur.update({
          where: { id: user.id },
          data: { estActif: true },
        });
      }
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
