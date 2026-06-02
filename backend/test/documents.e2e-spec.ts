// test/documents.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { cleanDb, prisma } from './helpers/db-cleanup';

const PASSWORD_HASH = '$2b$12$hOyZCEeNnKq1Cg5M8mK2g.kKlSUyuBEunGASq7w.YeUvfUB49ZXuW';

function uniqueOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function setupUserAndWorkspace(app: INestApplication, email = 'user@test.com') {
  const user = await prisma.utilisateur.create({
    data: { nom: 'Test User', email, motDePasse: PASSWORD_HASH, estActif: true },
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
    .send({ email, otp });

  const cookies = loginRes.headers['set-cookie'] as unknown as string[];

  const workspace = await prisma.workspace.create({
    data: {
      nom: 'Test Workspace',
      proprietaireId: user.id,
      membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
    },
  });

  return { user, workspace, cookies };
}

describe('Documents (e2e)', () => {
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

  // ── POST /workspaces/:id/documents ─────────────────────────────────────────

  describe('POST /workspaces/:workspaceId/documents', () => {
    it('creates a document and returns 201', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const res = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'My First Doc' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('titre', 'My First Doc');
      expect(res.body).toHaveProperty('isFavori', false);
    });

    it('auto-renames duplicate titles — "Doc" → "Doc (1)"', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Doc' });

      const res = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Doc' });

      expect(res.status).toBe(201);
      expect(res.body.titre).toBe('Doc (1)');
    });

    it('uses "Sans titre" when titre is not provided', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const res = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.titre).toBe('Sans titre');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/workspaces/any-id/documents')
        .send({ titre: 'Doc' });

      expect(res.status).toBe(401);
    });

    it('persists document in database', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Persisted Doc' });

      const doc = await prisma.document.findFirst({
        where: { workspaceId: workspace.id, titre: 'Persisted Doc' },
      });
      expect(doc).not.toBeNull();
    });
  });

  // ── GET /workspaces/:id/documents ──────────────────────────────────────────

  describe('GET /workspaces/:workspaceId/documents', () => {
    it('returns list of documents for workspace member', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Doc A' });
      await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Doc B' });

      const res = await request(app.getHttpServer())
        .get(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app.getHttpServer()).get('/workspaces/any-id/documents');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /documents/:id ─────────────────────────────────────────────────────

  describe('GET /documents/:id', () => {
    it('returns document by id', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const createRes = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Specific Doc' });

      const res = await request(app.getHttpServer())
        .get(`/documents/${createRes.body.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('titre', 'Specific Doc');
      expect(res.body).toHaveProperty('isFavori');
    });

    it('returns 404 for non-existent document', async () => {
      const { cookies } = await setupUserAndWorkspace(app);

      const res = await request(app.getHttpServer())
        .get('/documents/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies);

      expect(res.status).toBe(404);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app.getHttpServer()).get('/documents/some-id');
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /documents/:id ───────────────────────────────────────────────────

  describe('PATCH /documents/:id', () => {
    it('updates document title', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const createRes = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Original Title' });

      const res = await request(app.getHttpServer())
        .patch(`/documents/${createRes.body.id}`)
        .set('Cookie', cookies)
        .send({ titre: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('titre', 'Updated Title');
    });

    it('returns 409 when renaming to an existing title', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Existing Doc' });

      const secondDoc = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Other Doc' });

      const res = await request(app.getHttpServer())
        .patch(`/documents/${secondDoc.body.id}`)
        .set('Cookie', cookies)
        .send({ titre: 'Existing Doc' });

      expect(res.status).toBe(409);
    });

    it('creates a version when content is updated', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const createRes = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Doc' });

      await request(app.getHttpServer())
        .patch(`/documents/${createRes.body.id}`)
        .set('Cookie', cookies)
        .send({ contenu: { type: 'doc', content: [{ type: 'paragraph' }] } });

      const versions = await prisma.versionDocument.findMany({
        where: { documentId: createRes.body.id },
      });
      expect(versions).toHaveLength(1);
    });
  });

  // ── DELETE /documents/:id ──────────────────────────────────────────────────

  describe('DELETE /documents/:id', () => {
    it('deletes document and returns success message', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const createRes = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'To Delete' });

      const res = await request(app.getHttpServer())
        .delete(`/documents/${createRes.body.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      const doc = await prisma.document.findUnique({ where: { id: createRes.body.id } });
      expect(doc).toBeNull();
    });

    it('returns 404 when deleting non-existent document', async () => {
      const { cookies } = await setupUserAndWorkspace(app);

      const res = await request(app.getHttpServer())
        .delete('/documents/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /documents/:id/favori ─────────────────────────────────────────────

  describe('POST /documents/:id/favori', () => {
    it('toggles favori on and off', async () => {
      const { workspace, cookies } = await setupUserAndWorkspace(app);

      const createRes = await request(app.getHttpServer())
        .post(`/workspaces/${workspace.id}/documents`)
        .set('Cookie', cookies)
        .send({ titre: 'Fav Doc' });

      const addRes = await request(app.getHttpServer())
        .post(`/documents/${createRes.body.id}/favori`)
        .set('Cookie', cookies);
      expect(addRes.status).toBe(201);
      expect(addRes.body).toHaveProperty('isFavori', true);

      const removeRes = await request(app.getHttpServer())
        .post(`/documents/${createRes.body.id}/favori`)
        .set('Cookie', cookies);
      expect(removeRes.status).toBe(201);
      expect(removeRes.body).toHaveProperty('isFavori', false);
    });
  });
});