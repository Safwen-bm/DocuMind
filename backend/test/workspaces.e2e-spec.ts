// test/workspaces.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import { cleanDb, prisma } from './helpers/db-cleanup';

// ── Helper ────────────────────────────────────────────────────────────────────

function uniqueOtp(): string {
  // Use timestamp + random to guarantee uniqueness within a test run
  const ts = Date.now() % 900000;
  return String(100000 + ts).slice(0, 6);
}

// bcrypt hash of "password123" at rounds=12 — verified correct
const PASSWORD_HASH = '$2b$12$hOyZCEeNnKq1Cg5M8mK2g.kKlSUyuBEunGASq7w.YeUvfUB49ZXuW';

async function loginUser(app: INestApplication, email: string, nom = 'User') {
  const user = await prisma.utilisateur.create({
    data: { nom, email, motDePasse: PASSWORD_HASH, estActif: true },
  });

  // Use a random OTP that satisfies @Length(6,6)
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.tokenVerification.create({
    data: {
      utilisateurId: user.id,
      token: otp,
      type: 'OTP_2FA',
      expiration: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const res = await request(app.getHttpServer())
    .post('/auth/verify-otp')
    .send({ email, otp });

  // Verify the OTP exchange actually worked before continuing
  if (res.status !== 201) {
    throw new Error(
      `loginUser: verify-otp failed for ${email}. ` +
      `Status: ${res.status}. Body: ${JSON.stringify(res.body)}`
    );
  }

  const cookies = res.headers['set-cookie'] as unknown as string[];
  return { user, cookies };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Workspaces & Members (e2e)', () => {
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

  // ── GET /workspaces ────────────────────────────────────────────────────────

  describe('GET /workspaces', () => {
    it('returns empty array when user has no workspaces', async () => {
      const { cookies } = await loginUser(app, 'user@test.com');

      const res = await request(app.getHttpServer())
        .get('/workspaces')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns workspaces the user is a member of', async () => {
      const { user, cookies } = await loginUser(app, 'owner@test.com');

      await prisma.workspace.create({
        data: {
          nom: 'My Workspace',
          proprietaireId: user.id,
          membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
        },
      });

      const res = await request(app.getHttpServer())
        .get('/workspaces')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('nom', 'My Workspace');
      expect(res.body[0]).toHaveProperty('monRole', 'PROPRIETAIRE');
      expect(res.body[0]).toHaveProperty('isOwner', true);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app.getHttpServer()).get('/workspaces');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /workspaces/:id ────────────────────────────────────────────────────

  describe('GET /workspaces/:id', () => {
    it('returns workspace details for a member', async () => {
      const { user, cookies } = await loginUser(app, 'owner@test.com');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Detail WS',
          proprietaireId: user.id,
          membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/workspaces/${workspace.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', workspace.id);
      expect(res.body).toHaveProperty('monRole', 'PROPRIETAIRE');
    });

    it('returns 404 when user is not a member', async () => {
      const { user: owner } = await loginUser(app, 'owner@test.com');
      const { cookies: otherCookies } = await loginUser(app, 'other@test.com');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Private WS',
          proprietaireId: owner.id,
          membres: { create: { utilisateurId: owner.id, role: 'PROPRIETAIRE' } },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/workspaces/${workspace.id}`)
        .set('Cookie', otherCookies);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /workspaces/:id ──────────────────────────────────────────────────

  describe('PATCH /workspaces/:id', () => {
    it('allows PROPRIETAIRE to update workspace name', async () => {
      const { user, cookies } = await loginUser(app, 'owner@test.com');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Old Name',
          proprietaireId: user.id,
          membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/workspaces/${workspace.id}`)
        .set('Cookie', cookies)
        .send({ nom: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('nom', 'New Name');
    });

    it('returns 403 when EDITEUR tries to update workspace', async () => {
      const { user: owner } = await loginUser(app, 'owner@test.com');
      const { user: editor, cookies: editorCookies } = await loginUser(app, 'editor@test.com', 'Editor');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: editor.id, role: 'EDITEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/workspaces/${workspace.id}`)
        .set('Cookie', editorCookies)
        .send({ nom: 'Hacked Name' });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /workspaces/:id ─────────────────────────────────────────────────

  describe('DELETE /workspaces/:id', () => {
    it('allows PROPRIETAIRE to delete workspace', async () => {
      const { user, cookies } = await loginUser(app, 'owner@test.com');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'To Delete',
          proprietaireId: user.id,
          membres: { create: { utilisateurId: user.id, role: 'PROPRIETAIRE' } },
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/workspaces/${workspace.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);

      const deleted = await prisma.workspace.findUnique({ where: { id: workspace.id } });
      expect(deleted).toBeNull();
    });

    it('returns 403 when ADMINISTRATEUR tries to delete workspace', async () => {
      const { user: owner } = await loginUser(app, 'owner@test.com');
      const { user: admin, cookies: adminCookies } = await loginUser(app, 'admin@test.com', 'Admin');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Protected WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: admin.id, role: 'ADMINISTRATEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/workspaces/${workspace.id}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /workspaces/:id/members ────────────────────────────────────────────

  describe('GET /workspaces/:id/members', () => {
    it('returns members list for workspace member', async () => {
      const { user: owner, cookies } = await loginUser(app, 'owner@test.com');
      const { user: member } = await loginUser(app, 'member@test.com', 'Member');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Team WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: member.id, role: 'LECTEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/workspaces/${workspace.id}/members`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });

  // ── PATCH /workspaces/:id/members/:userId ──────────────────────────────────

  describe('PATCH /workspaces/:id/members/:userId (role change)', () => {
    it('allows PROPRIETAIRE to change member role', async () => {
      const { user: owner, cookies } = await loginUser(app, 'owner@test.com');
      const { user: member } = await loginUser(app, 'member@test.com', 'Member');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Team WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: member.id, role: 'LECTEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/workspaces/${workspace.id}/members/${member.id}`)
        .set('Cookie', cookies)
        .send({ role: 'EDITEUR' });

      expect(res.status).toBe(200);

      const updated = await prisma.membreWorkspace.findUnique({
        where: { utilisateurId_workspaceId: { utilisateurId: member.id, workspaceId: workspace.id } },
      });
      expect(updated!.role).toBe('EDITEUR');
    });

    it('returns 403 when EDITEUR tries to change roles', async () => {
      const { user: owner } = await loginUser(app, 'owner@test.com');
      const { user: editor, cookies: editorCookies } = await loginUser(app, 'editor@test.com', 'Editor');
      const { user: target } = await loginUser(app, 'target@test.com', 'Target');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Team WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: editor.id, role: 'EDITEUR' },
              { utilisateurId: target.id, role: 'LECTEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/workspaces/${workspace.id}/members/${target.id}`)
        .set('Cookie', editorCookies)
        .send({ role: 'EDITEUR' });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /workspaces/:id/members/:userId ─────────────────────────────────

  describe('DELETE /workspaces/:id/members/:userId', () => {
    it('allows PROPRIETAIRE to remove a member', async () => {
      const { user: owner, cookies } = await loginUser(app, 'owner@test.com');
      const { user: member } = await loginUser(app, 'member@test.com', 'Member');

      const workspace = await prisma.workspace.create({
        data: {
          nom: 'Team WS',
          proprietaireId: owner.id,
          membres: {
            create: [
              { utilisateurId: owner.id, role: 'PROPRIETAIRE' },
              { utilisateurId: member.id, role: 'LECTEUR' },
            ],
          },
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/workspaces/${workspace.id}/members/${member.id}`)
        .set('Cookie', cookies);

      expect(res.status).toBe(200);

      const removed = await prisma.membreWorkspace.findUnique({
        where: { utilisateurId_workspaceId: { utilisateurId: member.id, workspaceId: workspace.id } },
      });
      expect(removed).toBeNull();
    });
  });
});