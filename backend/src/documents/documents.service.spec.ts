// backend\src\documents\documents.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from '../activite/activite.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { PlansService } from '../plans/plans.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Role, ActionType } from '@prisma/client';

// ── Factories ─────────────────────────────────────────────────────────────────

const makeDoc = (overrides = {}) => ({
  id: 'doc-1',
  titre: 'My Document',
  workspaceId: 'ws-1',
  dossierId: null,
  authorId: 'user-1',
  contenu: { type: 'doc', content: [] },
  estArchive: false,
  dateCreation: new Date(),
  dateMiseAJour: new Date(),
  author: { id: 'user-1', nom: 'Safwen', avatarUrl: null },
  dossier: null,
  ...overrides,
});

const makeMembre = (role: Role = Role.EDITEUR) => ({
  utilisateurId: 'user-1',
  workspaceId: 'ws-1',
  role,
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prisma = {
  document: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  membreWorkspace: { findUnique: jest.fn(), findMany: jest.fn() },
  documentFavori: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  documentView: { upsert: jest.fn().mockResolvedValue({}) },
  versionDocument: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  utilisateur: { findUnique: jest.fn() },
};

const activite = { log: jest.fn().mockResolvedValue(undefined) };
const notifications = { create: jest.fn().mockResolvedValue(undefined) };
const aiService = { indexDocument: jest.fn().mockResolvedValue(undefined) };
const plans = { assertCanCreateDocument: jest.fn().mockResolvedValue(undefined) };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActiviteService, useValue: activite },
        { provide: NotificationsService, useValue: notifications },
        { provide: AiService, useValue: aiService },
        { provide: PlansService, useValue: plans },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { titre: 'New Doc' };

    beforeEach(() => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
      prisma.document.findFirst.mockResolvedValue(null); // title is free
      prisma.document.create.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findMany.mockResolvedValue([]);
    });

    it('throws ForbiddenException when user is LECTEUR', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.LECTEUR));
      await expect(service.create('user-1', 'ws-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('checks plan limits before creating', async () => {
      await service.create('user-1', 'ws-1', dto);
      expect(plans.assertCanCreateDocument).toHaveBeenCalledWith('ws-1');
    });

    it('uses "Sans titre" when titre is empty', async () => {
      await service.create('user-1', 'ws-1', { titre: '' });
      const createArg = prisma.document.create.mock.calls[0][0];
      expect(createArg.data.titre).toBe('Sans titre');
    });

    it('auto-renames to "Doc (1)" when "Doc" is already taken', async () => {
      // First findFirst: "Doc" is taken, second: "Doc (1)" is free
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'other-doc' }) // "Doc" taken
        .mockResolvedValueOnce(null);               // "Doc (1)" free

      await service.create('user-1', 'ws-1', { titre: 'Doc' });

      const createArg = prisma.document.create.mock.calls[0][0];
      expect(createArg.data.titre).toBe('Doc (1)');
    });

    it('auto-renames to "Doc (2)" when "Doc" and "Doc (1)" are both taken', async () => {
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'a' }) // "Doc" taken
        .mockResolvedValueOnce({ id: 'b' }) // "Doc (1)" taken
        .mockResolvedValueOnce(null);        // "Doc (2)" free

      await service.create('user-1', 'ws-1', { titre: 'Doc' });

      const createArg = prisma.document.create.mock.calls[0][0];
      expect(createArg.data.titre).toBe('Doc (2)');
    });

    it('strips existing "(N)" suffix before computing new suffix', async () => {
      // Input "Doc (3)" — should try "Doc", "Doc (1)", "Doc (2)", "Doc (3)" base etc.
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'a' }) // "Doc (3)" taken (fast path)
        .mockResolvedValueOnce(null);        // "Doc (1)" free

      await service.create('user-1', 'ws-1', { titre: 'Doc (3)' });

      const createArg = prisma.document.create.mock.calls[0][0];
      expect(createArg.data.titre).toBe('Doc (1)');
    });

    it('logs DOCUMENT_CREE activity after creation', async () => {
      await service.create('user-1', 'ws-1', dto);
      expect(activite.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: ActionType.DOCUMENT_CREE }),
      );
    });

    it('returns the created document with isFavori: false', async () => {
      const result = await service.create('user-1', 'ws-1', dto);
      expect(result).toHaveProperty('isFavori', false);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not a workspace member', async () => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'doc-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns document with isFavori: true when user has favorited it', async () => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre());
      prisma.documentFavori.findUnique.mockResolvedValue({ id: 'fav-1' });

      const result = await service.findOne('user-1', 'doc-1');
      expect(result).toHaveProperty('isFavori', true);
    });

    it('returns document with isFavori: false when not favorited', async () => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre());
      prisma.documentFavori.findUnique.mockResolvedValue(null);

      const result = await service.findOne('user-1', 'doc-1');
      expect(result).toHaveProperty('isFavori', false);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
      prisma.document.findFirst.mockResolvedValue(null); // no conflict
      prisma.versionDocument.findFirst.mockResolvedValue(null);
      prisma.versionDocument.create.mockResolvedValue({});
      prisma.document.update.mockResolvedValue(makeDoc({ titre: 'Updated' }));
      prisma.documentFavori.findUnique.mockResolvedValue(null);
      prisma.utilisateur.findUnique.mockResolvedValue({ nom: 'Safwen' });
      prisma.membreWorkspace.findMany.mockResolvedValue([]);
    });

    it('throws NotFoundException when document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(
        service.update('user-1', 'doc-1', { titre: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is LECTEUR', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.LECTEUR));
      await expect(
        service.update('user-1', 'doc-1', { titre: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when renamed title is already taken', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'other-doc' });
      await expect(
        service.update('user-1', 'doc-1', { titre: 'Existing Doc' }),
      ).rejects.toThrow(ConflictException);
    });

    it('saves a version snapshot when content changes', async () => {
      await service.update('user-1', 'doc-1', {
        contenu: { type: 'doc', content: [{ type: 'paragraph' }] },
      });
      expect(prisma.versionDocument.create).toHaveBeenCalled();
    });

    it('does NOT save a version when only title changes', async () => {
      await service.update('user-1', 'doc-1', { titre: 'New Title' });
      expect(prisma.versionDocument.create).not.toHaveBeenCalled();
    });

    it('triggers AI re-index in background when content changes', async () => {
      await service.update('user-1', 'doc-1', {
        contenu: { type: 'doc', content: [] },
      });
      expect(aiService.indexDocument).toHaveBeenCalledWith('doc-1');
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.remove('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is LECTEUR', async () => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.LECTEUR));
      await expect(service.remove('user-1', 'doc-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes document and logs DOCUMENT_SUPPRIME activity', async () => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre(Role.EDITEUR));
      prisma.document.delete.mockResolvedValue({});

      await service.remove('user-1', 'doc-1');

      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });
      expect(activite.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: ActionType.DOCUMENT_SUPPRIME }),
      );
    });
  });

  // ── toggleFavori ───────────────────────────────────────────────────────────

  describe('toggleFavori', () => {
    beforeEach(() => {
      prisma.document.findUnique.mockResolvedValue(makeDoc());
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre());
    });

    it('throws NotFoundException when document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.toggleFavori('user-1', 'doc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes favori and returns isFavori: false when already favorited', async () => {
      prisma.documentFavori.findUnique.mockResolvedValue({ id: 'fav-1' });
      prisma.documentFavori.delete.mockResolvedValue({});

      const result = await service.toggleFavori('user-1', 'doc-1');
      expect(result).toEqual({ isFavori: false });
      expect(prisma.documentFavori.delete).toHaveBeenCalled();
    });

    it('adds favori and returns isFavori: true when not yet favorited', async () => {
      prisma.documentFavori.findUnique.mockResolvedValue(null);
      prisma.documentFavori.create.mockResolvedValue({});

      const result = await service.toggleFavori('user-1', 'doc-1');
      expect(result).toEqual({ isFavori: true });
      expect(prisma.documentFavori.create).toHaveBeenCalled();
    });
  });
});