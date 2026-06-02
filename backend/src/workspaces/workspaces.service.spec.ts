import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

// ── Factories ─────────────────────────────────────────────────────────────────

const makeWorkspace = (overrides = {}) => ({
  id: 'ws-1',
  nom: 'My Workspace',
  description: 'Test workspace',
  proprietaireId: 'user-1',
  dateMiseAJour: new Date(),
  dateCreation: new Date(),
  membres: [],
  _count: { membres: 1 },
  proprietaire: { id: 'user-1', nom: 'Safwen', avatarUrl: null },
  subscription: null,
  ...overrides,
});

const makeMembre = (role: Role = Role.PROPRIETAIRE) => ({
  utilisateurId: 'user-1',
  workspaceId: 'ws-1',
  role,
  workspace: makeWorkspace(),
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prisma = {
  workspace: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  membreWorkspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  activite: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  document: { count: jest.fn() },
  messageIA: { count: jest.fn() },
  utilisateur: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
};

const plans = {
  assertCanCreateWorkspace: jest.fn().mockResolvedValue(undefined),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlansService, useValue: plans },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { nom: 'New Workspace', description: 'desc' };

    it('checks plan limit before creating', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue(makeWorkspace());

      await service.create('user-1', dto);

      expect(plans.assertCanCreateWorkspace).toHaveBeenCalledWith('user-1');
    });

    it('throws ConflictException when workspace with same name already exists', async () => {
      prisma.workspace.findFirst.mockResolvedValue(makeWorkspace());

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.workspace.create).not.toHaveBeenCalled();
    });

    it('creates workspace and adds creator as PROPRIETAIRE', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);
      prisma.workspace.create.mockResolvedValue(makeWorkspace());

      await service.create('user-1', dto);

      const createArg = prisma.workspace.create.mock.calls[0][0];
      expect(createArg.data.proprietaireId).toBe('user-1');
      expect(createArg.data.membres.create.role).toBe(Role.PROPRIETAIRE);
      expect(createArg.data.membres.create.utilisateurId).toBe('user-1');
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns workspaces with monRole and isOwner fields', async () => {
      prisma.membreWorkspace.findMany.mockResolvedValue([makeMembre()]);

      const result = await service.findAll('user-1');

      expect(result[0]).toHaveProperty('monRole', Role.PROPRIETAIRE);
      expect(result[0]).toHaveProperty('isOwner', true);
    });

    it('sets isOwner: false when user is not the proprietaire', async () => {
      const membre = makeMembre(Role.EDITEUR);
      membre.workspace.proprietaireId = 'other-user';
      prisma.membreWorkspace.findMany.mockResolvedValue([membre]);

      const result = await service.findAll('user-1');

      expect(result[0]).toHaveProperty('isOwner', false);
    });

    it('returns FREE plan when subscription is null', async () => {
      prisma.membreWorkspace.findMany.mockResolvedValue([makeMembre()]);

      const result = await service.findAll('user-1');

      expect(result[0]).toHaveProperty('plan', 'FREE');
    });

    it('returns active subscription plan when subscription exists', async () => {
      const membre = makeMembre();
      membre.workspace.subscription = { plan: 'PRO', status: 'active' } as any;
      prisma.membreWorkspace.findMany.mockResolvedValue([membre]);

      const result = await service.findAll('user-1');

      expect(result[0]).toHaveProperty('plan', 'PRO');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when user is not a member', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns workspace with monRole and isOwner', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(makeMembre());

      const result = await service.findOne('user-1', 'ws-1');

      expect(result).toHaveProperty('monRole', Role.PROPRIETAIRE);
      expect(result).toHaveProperty('isOwner', true);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when user is not a member', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(null);
      await expect(
        service.update('user-1', 'ws-1', { nom: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is LECTEUR or EDITEUR', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.EDITEUR),
      );
      await expect(
        service.update('user-1', 'ws-1', { nom: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when new name conflicts with another workspace', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.ADMINISTRATEUR),
      );
      prisma.workspace.findFirst.mockResolvedValue(makeWorkspace({ id: 'other-ws' }));

      await expect(
        service.update('user-1', 'ws-1', { nom: 'Existing Name' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows ADMINISTRATEUR to update workspace', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.ADMINISTRATEUR),
      );
      prisma.workspace.findFirst.mockResolvedValue(null); // no conflict
      prisma.workspace.update.mockResolvedValue(makeWorkspace({ nom: 'Updated' }));

      const result = await service.update('user-1', 'ws-1', { nom: 'Updated' });
      expect(result).toHaveProperty('nom', 'Updated');
    });

    it('allows PROPRIETAIRE to update workspace', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.PROPRIETAIRE),
      );
      prisma.workspace.findFirst.mockResolvedValue(null);
      prisma.workspace.update.mockResolvedValue(makeWorkspace({ nom: 'Updated' }));

      await expect(
        service.update('user-1', 'ws-1', { nom: 'Updated' }),
      ).resolves.not.toThrow();
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws ForbiddenException when user is not PROPRIETAIRE', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.ADMINISTRATEUR),
      );
      await expect(service.remove('user-1', 'ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes workspace when user is PROPRIETAIRE', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.PROPRIETAIRE),
      );
      prisma.workspace.delete.mockResolvedValue({});

      await service.remove('user-1', 'ws-1');

      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
      });
    });

    it('returns success message', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.PROPRIETAIRE),
      );
      prisma.workspace.delete.mockResolvedValue({});

      const result = await service.remove('user-1', 'ws-1');
      expect(result).toHaveProperty('message');
    });
  });

  // ── getMembersForFilter ────────────────────────────────────────────────────

  describe('getMembersForFilter', () => {
    it('throws NotFoundException when user is not a member', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(null);
      await expect(
        service.getMembersForFilter('user-1', 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is below ADMINISTRATEUR', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.EDITEUR),
      );
      await expect(
        service.getMembersForFilter('user-1', 'ws-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns members list for ADMINISTRATEUR', async () => {
      prisma.membreWorkspace.findUnique.mockResolvedValue(
        makeMembre(Role.ADMINISTRATEUR),
      );
      prisma.membreWorkspace.findMany.mockResolvedValue([makeMembre()]);

      const result = await service.getMembersForFilter('user-1', 'ws-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});