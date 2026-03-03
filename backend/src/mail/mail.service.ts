import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  async sendConfirmationEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/confirm-email?token=${token}`;
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Confirmez votre compte',
      html: `
        <h2>Bienvenue sur la plateforme</h2>
        <p>Cliquez sur le lien ci-dessous pour activer votre compte :</p>
        <a href="${url}">Confirmer mon compte</a>
        <p>Ce lien expire dans 24 heures.</p>
      `,
    });
  }

  async sendOtpEmail(email: string, otp: string) {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Votre code de vérification',
      html: `
        <h2>Code de vérification</h2>
        <p>Votre code OTP est :</p>
        <h1 style="letter-spacing: 8px; color: #1E3A8A;">${otp}</h1>
        <p>Ce code expire dans 10 minutes.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Réinitialisation de mot de passe',
      html: `
        <h2>Réinitialisation de mot de passe</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${url}">Réinitialiser mon mot de passe</a>
        <p>Ce lien expire dans 1 heure.</p>
      `,
    });
  }

  async sendInvitationEmail(
    email: string,
    workspaceName: string,
    token: string,
  ) {
    const url = `${process.env.FRONTEND_URL}/en/invitations/accept?token=${token}`;
    await this.transporter.sendMail({
      from: `"DocuMind" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: `Invitation to join ${workspaceName} on DocuMind`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p>You have been invited to join the workspace <strong>${workspaceName}</strong> on DocuMind.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#3b5bdb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">
          Accept Invitation
        </a>
        <p style="margin-top:16px;color:#666;font-size:13px;">This link expires in 7 days.</p>
      </div>
    `,
    });
  }
}
