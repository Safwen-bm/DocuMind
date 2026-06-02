// test/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { cleanDb, prisma } from './helpers/db-cleanup';

const PASSWORD_HASH = '$2b$12$hOyZCEeNnKq1Cg5M8mK2g.kKlSUyuBEunGASq7w.YeUvfUB49ZXuW';

function uniqueOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  beforeEach(async () => {
    await cleanDb();
  }, 15_000);

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
    await app.close();
  }, 30_000);

  // ── POST /auth/register ────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns 201 and success message on valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
    });

    it('creates the user in the database', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: 'password123' });

      const user = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      expect(user).not.toBeNull();
      expect(user!.nom).toBe('Safwen');
      expect(user!.estActif).toBe(false);
    });

    it('creates a CONFIRMATION_EMAIL token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: 'password123' });

      const user = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      const token = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: user!.id, type: 'CONFIRMATION_EMAIL' },
      });
      expect(token).not.toBeNull();
    });

    it('returns 400 when email is already taken', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Other', email: 'safwen@test.com', motDePasse: 'password123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'safwen@test.com' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: '123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email is invalid format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'not-an-email', motDePasse: 'password123' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /auth/confirm-email ────────────────────────────────────────────────

  describe('GET /auth/confirm-email', () => {
    it('activates user account with valid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'safwen@test.com', motDePasse: 'password123' });

      const user = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      const tokenRecord = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: user!.id, type: 'CONFIRMATION_EMAIL' },
      });

      const res = await request(app.getHttpServer())
        .get(`/auth/confirm-email?token=${tokenRecord!.token}`);

      expect(res.status).toBe(200);

      const updated = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      expect(updated!.estActif).toBe(true);
    });

    it('returns 400 for invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/confirm-email?token=invalid-token-xyz');
      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await prisma.utilisateur.create({
        data: { nom: 'Safwen', email: 'safwen@test.com', motDePasse: PASSWORD_HASH, estActif: true },
      });
    });

    it('returns 201 and OTP message on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'safwen@test.com', motDePasse: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
    });

    it('creates an OTP_2FA token in DB', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'safwen@test.com', motDePasse: 'password123' });

      const user = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      const otp = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: user!.id, type: 'OTP_2FA' },
      });
      expect(otp).not.toBeNull();
      expect(otp!.token).toMatch(/^\d{6}$/);
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'safwen@test.com', motDePasse: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', motDePasse: 'password123' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when body is empty', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('locks account after 5 failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'safwen@test.com', motDePasse: 'wrong' });
      }

      const user = await prisma.utilisateur.findUnique({ where: { email: 'safwen@test.com' } });
      expect(user!.verrouillageJusqua).not.toBeNull();
      expect(user!.verrouillageJusqua!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ── POST /auth/verify-otp ──────────────────────────────────────────────────

  describe('POST /auth/verify-otp', () => {
    let userId: string;
    let otpToken: string;

    beforeEach(async () => {
      const user = await prisma.utilisateur.create({
        data: { nom: 'Safwen', email: 'safwen@test.com', motDePasse: PASSWORD_HASH, estActif: true },
      });
      userId = user.id;
      otpToken = uniqueOtp(); // fresh unique 6-digit OTP every time

      await prisma.tokenVerification.create({
        data: {
          utilisateurId: userId,
          token: otpToken,
          type: 'OTP_2FA',
          expiration: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
    });

    it('returns 201 and sets access_token cookie on valid OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'safwen@test.com', otp: otpToken });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', 'safwen@test.com');

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.find((c: string) => c.startsWith('access_token='))).toBeDefined();
    });

    it('deletes the OTP after successful verification', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'safwen@test.com', otp: otpToken });

      const otp = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: userId, type: 'OTP_2FA' },
      });
      expect(otp).toBeNull();
    });

    it('returns 401 for wrong OTP', async () => {
      // Use a different valid-format OTP that won't match
      const wrongOtp = otpToken === '111111' ? '222222' : '111111';
      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'safwen@test.com', otp: wrongOtp });
      expect(res.status).toBe(401);
    });

    it('returns 401 for expired OTP', async () => {
      await prisma.tokenVerification.updateMany({
        where: { utilisateurId: userId, type: 'OTP_2FA' },
        data: { expiration: new Date(Date.now() - 1000) },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'safwen@test.com', otp: otpToken });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user info with valid cookie', async () => {
      const user = await prisma.utilisateur.create({
        data: { nom: 'Safwen', email: 'safwen@test.com', motDePasse: PASSWORD_HASH, estActif: true },
      });

      const otp = uniqueOtp();
      await prisma.tokenVerification.create({
        data: {
          utilisateurId: user.id,
          token: otp,
          type: 'OTP_2FA',
          expiration: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'safwen@test.com', otp });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('email', 'safwen@test.com');
      expect(meRes.body).not.toHaveProperty('motDePasse');
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 201 and clears access_token cookie', async () => {
      const res = await request(app.getHttpServer()).post('/auth/logout');
      expect(res.status).toBe(201);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      if (cookies) {
        const cleared = cookies.find((c: string) => c.startsWith('access_token='));
        expect(
          cleared?.includes('access_token=;') ||
          cleared?.includes('Expires=Thu, 01 Jan 1970'),
        ).toBe(true);
      }
    });
  });

  // ── Full auth flow ─────────────────────────────────────────────────────────

  describe('Full flow: register → confirm → login → OTP → me', () => {
    it('completes the entire auth flow end-to-end', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ nom: 'Safwen', email: 'flow@test.com', motDePasse: 'password123' });
      expect(registerRes.status).toBe(201);

      const user = await prisma.utilisateur.findUnique({ where: { email: 'flow@test.com' } });
      const confirmToken = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: user!.id, type: 'CONFIRMATION_EMAIL' },
      });

      const confirmRes = await request(app.getHttpServer())
        .get(`/auth/confirm-email?token=${confirmToken!.token}`);
      expect(confirmRes.status).toBe(200);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'flow@test.com', motDePasse: 'password123' });
      expect(loginRes.status).toBe(201);

      const otpRecord = await prisma.tokenVerification.findFirst({
        where: { utilisateurId: user!.id, type: 'OTP_2FA' },
      });

      const otpRes = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'flow@test.com', otp: otpRecord!.token });
      expect(otpRes.status).toBe(201);
      expect(otpRes.body.user.email).toBe('flow@test.com');

      const cookies = otpRes.headers['set-cookie'] as unknown as string[];

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('flow@test.com');
    });
  });
});