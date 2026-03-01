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
}