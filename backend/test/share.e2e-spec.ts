// test/share.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { cleanDb, prisma } from './helpers/db-cleanup';

const PASSWORD_HASH = '$2b$12$hOyZCEeNnKq1Cg5M8mK2g.kKlSUyuBEunGASq7w.YeUvfUB49ZXuW';

function uniqueOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function setupWithDoc(app: INestApplication) {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Owner', email: 'owner@test.com', motDePasse: PASSWORD_HASH, estActif: true },
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
    .send({ email: 'owner@test.com', otp });

  if (loginRes.status !== 201) {
    throw new Error(
      `setupWithDoc: verify-otp failed. Status: ${loginRes.status}. Body: ${JSON.stringify(loginRes.body)}`
    );
  }

  const cookies = loginRes.headers['set-cookie'] as unknown as string[];

  const workspace = await prisma.workspace.create({
    data: {
      nom: 'Share Test WS',
      proprietaireId: user.id,
      membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
    },
  });

  const docRes = await request(app.getHttpServer())
    .post(`/workspaces/${workspace.id}/documents`)
    .set('Cookie', cookies)
    .send({ titre: 'Shared Document' });

  if (docRes.status !== 201) {
    throw new Error(
      `setupWithDoc: document creation failed. Status: ${docRes.status}. Body: ${JSON.stringify(docRes.body)}`
    );
  }

  return { user, workspace, document: docRes.body, cookies };
}

describe('Share Tokens (e2e)', () => {
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

  describe('POST /documents/:id/share', () => {
    it('generates a share token and returns it', async () => {
      const { document, cookies } = await setupWithDoc(app);

      const res = await request(app.getHttpServer())
        .post(`/documents/${document.id}/share`)
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(10);
    });

    it('persists share token in the database', async () => {
      const { document, cookies } = await setupWithDoc(app);

      const res = await request(app.getHttpServer())
        .post(`/documents/${document.id}/share`)
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'

      expect(res.status).toBe(201);

      const token = await prisma.shareToken.findFirst({ where: { documentId: document.id } });
      expect(token).not.toBeNull();
      expect(token!.token).toBe(res.body.token);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/some-id/share')
        .send({ permission: 'READ' });        // ← was 'LECTURE'
      expect(res.status).toBe(401);
    });

    it('returns 404 when document does not exist', async () => {
      const { cookies } = await setupWithDoc(app);

      const res = await request(app.getHttpServer())
        .post('/documents/00000000-0000-0000-0000-000000000000/share')
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'
      expect(res.status).toBe(404);
    });
  });

  describe('GET /documents/:id/share', () => {
    it('returns existing share tokens for a document', async () => {
      const { document, cookies } = await setupWithDoc(app);

      await request(app.getHttpServer())
        .post(`/documents/${document.id}/share`)
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'

      const res = await request(app.getHttpServer())
        .get(`/documents/${document.id}/share`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /share/:token (public access)', () => {
    it('returns document content via share token — no auth needed', async () => {
      const { document, cookies } = await setupWithDoc(app);

      const shareRes = await request(app.getHttpServer())
        .post(`/documents/${document.id}/share`)
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'

      expect(shareRes.status).toBe(201);

      const res = await request(app.getHttpServer()).get(`/share/${shareRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('document');
      expect(res.body.document).toHaveProperty('titre', 'Shared Document');
    });

    it('returns 404 for non-existent share token', async () => {
      const res = await request(app.getHttpServer()).get('/share/invalid-token-xyz');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /share/tokens/:tokenId', () => {
    it('revokes a share token', async () => {
      const { document, cookies } = await setupWithDoc(app);

      const shareRes = await request(app.getHttpServer())
        .post(`/documents/${document.id}/share`)
        .set('Cookie', cookies)
        .send({ permission: 'READ' });        // ← was 'LECTURE'

      expect(shareRes.status).toBe(201);

      const token = await prisma.shareToken.findFirst({ where: { documentId: document.id } });
      expect(token).not.toBeNull();

      const res = await request(app.getHttpServer())
        .delete(`/share/tokens/${token!.id}`)
        .set('Cookie', cookies);
      expect(res.status).toBe(200);

      const accessRes = await request(app.getHttpServer()).get(`/share/${shareRes.body.token}`);
      expect(accessRes.status).toBe(404);
    });
  });
});