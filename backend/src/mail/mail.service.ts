// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\mail\mail.service.ts

import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// ── Design tokens — matched to your oklch(0.488 0.243 264.376) primary ────────
const BRAND = '#3B5BDB'; // indigo-600, closest hex to your primary
const BRAND_DARK = '#364FC7'; // indigo-700 for button hover
const BRAND_SOFT = '#EEF2FF'; // indigo-50 for subtle backgrounds
const BG_PAGE = '#F3F4F6'; // gray-100
const BG_CARD = '#FFFFFF';
const TEXT_MAIN = '#111827'; // gray-900
const TEXT_MUTED = '#6B7280'; // gray-500
const TEXT_LIGHT = '#9CA3AF'; // gray-400
const BORDER = '#E5E7EB'; // gray-200

// ── Shell: the outer wrapper every email uses ─────────────────────────────────
function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>DocuMind</title>
  <style>
    body{margin:0;padding:0;background-color:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}
    *{box-sizing:border-box;}
    a{color:${BRAND};text-decoration:none;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_PAGE};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:48px 16px 40px;">

        <!-- Max-width container -->
        <table role="presentation" width="100%" style="max-width:520px;" cellspacing="0" cellpadding="0" border="0">

          <!-- ── Logo ── -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Rounded square bg-primary -->
                  <td style="background-color:${BRAND};border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <!-- Brain icon (simplified SVG, white) -->
                    <img src="https://api.iconify.design/lucide:brain.svg?color=white&width=20&height=20"
                         width="20" height="20" alt=""
                         style="display:block;margin:8px auto;"
                    />
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:700;color:${TEXT_MAIN};letter-spacing:-0.4px;">DocuMind</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background-color:${BG_CARD};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">
              <div style="padding:40px 40px 36px;">
                ${content}
              </div>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:12px;color:${TEXT_LIGHT};line-height:1.7;margin:0;">
                © ${new Date().getFullYear()} DocuMind &nbsp;·&nbsp; AI-powered documentation platform<br/>
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Reusable blocks ───────────────────────────────────────────────────────────

function badge(label: string): string {
  return `<p style="margin:0 0 20px;">
    <span style="display:inline-block;background-color:${BRAND_SOFT};color:${BRAND};font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;padding:4px 12px;border-radius:99px;">${label}</span>
  </p>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TEXT_MAIN};letter-spacing:-0.3px;line-height:1.3;">${text}</h1>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:${TEXT_MUTED};line-height:1.7;">${html}</p>`;
}

function ctaButton(label: string, url: string): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
    <tr>
      <td style="border-radius:8px;background-color:${BRAND};">
        <a href="${url}"
           style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${BRAND};">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
    <tr><td style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

function urlFallback(url: string): string {
  return `<p style="margin:12px 0 0;font-size:12px;color:${TEXT_LIGHT};line-height:1.6;">
    Button not working? Paste this link into your browser:<br/>
    <a href="${url}" style="color:${BRAND};word-break:break-all;">${url}</a>
  </p>`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  // ── 1. Email confirmation ──────────────────────────────────────────────────

  async sendConfirmationEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/en/confirm-email?token=${token}`;

    const html = shell(`
      ${badge('Account Activation')}
      ${heading('Confirm your email address')}
      ${paragraph(`Welcome to DocuMind! You're one click away from your AI-powered workspace. Click the button below to activate your account.`)}
      ${ctaButton('Activate My Account', url)}
      ${divider()}
      <p style="margin:0;font-size:13px;color:${TEXT_LIGHT};">This link expires in <strong style="color:${TEXT_MUTED};">24 hours</strong>.</p>
      ${urlFallback(url)}
    `);

    await this.transporter.sendMail({
      from: `"DocuMind" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: 'Activate your DocuMind account',
      html,
    });
  }

  // ── 2. OTP ────────────────────────────────────────────────────────────────

  async sendOtpEmail(email: string, otp: string) {
    const html = shell(`
      ${badge('Security Code')}
      ${heading('Your verification code')}
      ${paragraph(`Use the code below to complete your sign-in. It's valid for <strong style="color:${TEXT_MAIN};">10 minutes</strong> and can only be used once.`)}

      <!-- Copyable OTP -->
<div style="
  margin:24px 0 18px;
  padding:18px 24px;
  background:${BRAND_SOFT};
  border:1px solid #C7D2FE;
  border-radius:12px;
  text-align:center;
">
  <span style="
    font-size:32px;
    font-weight:700;
    letter-spacing:8px;
    color:${BRAND};
    font-family:'Courier New',Courier,monospace;
  ">
    ${otp}
  </span>
</div>

      ${divider()}
      <p style="margin:0;font-size:13px;color:${TEXT_LIGHT};">
        Didn't request this? Your account is still secure — you can safely ignore this email.
      </p>
    `);

    await this.transporter.sendMail({
      from: `"DocuMind" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: 'DocuMind verification code',
      html,
    });
  }

  // ── 3. Password reset ──────────────────────────────────────────────────────

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/en/reset-password?token=${token}`;

    const html = shell(`
      ${badge('Password Reset')}
      ${heading('Reset your password')}
      ${paragraph(`We received a request to reset the password for your DocuMind account. Click the button below to choose a new password. If you didn't make this request, no action is needed.`)}
      ${ctaButton('Reset My Password', url)}
      ${divider()}
      <p style="margin:0;font-size:13px;color:${TEXT_LIGHT};">This link expires in <strong style="color:${TEXT_MUTED};">1 hour</strong>.</p>
      ${urlFallback(url)}
    `);

    await this.transporter.sendMail({
      from: `"DocuMind" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: 'Reset your DocuMind password',
      html,
    });
  }

  // ── 4. Workspace invitation ────────────────────────────────────────────────

  async sendInvitationEmail(
    email: string,
    workspaceName: string,
    token: string,
  ) {
    const url = `${process.env.FRONTEND_URL}/en/invitations/accept?token=${token}`;
    const initial = workspaceName.charAt(0).toUpperCase();

    const html = shell(`
      ${badge('Workspace Invitation')}
      ${heading("You've been invited to collaborate")}
      ${paragraph(`You've been invited to join <strong style="color:${TEXT_MAIN};">${workspaceName}</strong> on DocuMind. Click below to accept and start collaborating with your team.`)}

      <!-- Workspace pill -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;">
        <tr>
          <td style="background-color:${BRAND};border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;">
            <span style="font-size:18px;font-weight:700;color:#ffffff;line-height:40px;">${initial}</span>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:15px;font-weight:600;color:${TEXT_MAIN};">${workspaceName}</p>
            <p style="margin:2px 0 0;font-size:13px;color:${TEXT_MUTED};">DocuMind Workspace</p>
          </td>
        </tr>
      </table>

      ${ctaButton('Accept Invitation', url)}
      ${divider()}
      <p style="margin:0;font-size:13px;color:${TEXT_LIGHT};">This invitation expires in <strong style="color:${TEXT_MUTED};">7 days</strong>.</p>
      ${urlFallback(url)}
    `);

    await this.transporter.sendMail({
      from: `"DocuMind" <${process.env.MAIL_FROM}>`,
      to: email,
      subject: `You're invited to join ${workspaceName} on DocuMind`,
      html,
    });
  }
}
