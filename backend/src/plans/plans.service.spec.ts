import { Test, TestingModule } from '@nestjs/testing';
import { PlansService, PLAN_LIMITS } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prisma = {
  subscription: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  workspace: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  membreWorkspace: { count: jest.fn() },
  document: { count: jest.fn() },
  aiUsage: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const stripe = {
  createBillingPortalSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  // ── PLAN_LIMITS constant ───────────────────────────────────────────────────

  describe('PLAN_LIMITS', () => {
    it('FREE plan has 3 members, 10 documents, 10 AI questions per day', () => {
      expect(PLAN_LIMITS.FREE.membersPerWorkspace).toBe(3);
      expect(PLAN_LIMITS.FREE.documentsTotal).toBe(10);
      expect(PLAN_LIMITS.FREE.aiQuestionsPerDay).toBe(10);
    });

    it('PRO plan has unlimited members and AI questions, 100 documents', () => {
      expect(PLAN_LIMITS.PRO.membersPerWorkspace).toBe(Infinity);
      expect(PLAN_LIMITS.PRO.documentsTotal).toBe(100);
      expect(PLAN_LIMITS.PRO.aiQuestionsPerDay).toBe(Infinity);
    });

    it('ENTERPRISE plan has all limits as Infinity', () => {
      expect(PLAN_LIMITS.ENTERPRISE.membersPerWorkspace).toBe(Infinity);
      expect(PLAN_LIMITS.ENTERPRISE.documentsTotal).toBe(Infinity);
      expect(PLAN_LIMITS.ENTERPRISE.aiQuestionsPerDay).toBe(Infinity);
    });
  });

  // ── getWorkspacePlan ───────────────────────────────────────────────────────

  describe('getWorkspacePlan', () => {
    it('returns FREE when no subscription exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      expect(await service.getWorkspacePlan('ws-1')).toBe(Plan.FREE);
    });

    it('returns FREE when subscription is not active', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.PRO,
        status: 'cancelled',
      });
      expect(await service.getWorkspacePlan('ws-1')).toBe(Plan.FREE);
    });

    it('returns PRO when subscription is active with PRO plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.PRO,
        status: 'active',
      });
      expect(await service.getWorkspacePlan('ws-1')).toBe(Plan.PRO);
    });

    it('returns ENTERPRISE when subscription is active with ENTERPRISE plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.ENTERPRISE,
        status: 'active',
      });
      expect(await service.getWorkspacePlan('ws-1')).toBe(Plan.ENTERPRISE);
    });
  });

  // ── assertCanCreateWorkspace ───────────────────────────────────────────────

  describe('assertCanCreateWorkspace', () => {
    it('allows creating first workspace (count = 0)', async () => {
      prisma.workspace.count.mockResolvedValue(0);
      await expect(
        service.assertCanCreateWorkspace('user-1'),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when user already owns a workspace', async () => {
      prisma.workspace.count.mockResolvedValue(1);
      await expect(service.assertCanCreateWorkspace('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('includes PLAN_LIMIT_WORKSPACES code in the exception', async () => {
      prisma.workspace.count.mockResolvedValue(1);
      try {
        await service.assertCanCreateWorkspace('user-1');
      } catch (e: any) {
        expect(e.response.code).toBe('PLAN_LIMIT_WORKSPACES');
      }
    });
  });

  // ── assertCanAddMember ─────────────────────────────────────────────────────

  describe('assertCanAddMember', () => {
    it('allows adding member when under FREE limit (< 3)', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null); // FREE plan
      prisma.membreWorkspace.count.mockResolvedValue(2);
      await expect(service.assertCanAddMember('ws-1')).resolves.not.toThrow();
    });

    it('throws ForbiddenException when FREE plan member limit is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null); // FREE plan
      prisma.membreWorkspace.count.mockResolvedValue(3); // at limit
      await expect(service.assertCanAddMember('ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('includes PLAN_LIMIT_MEMBERS code in the exception', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.membreWorkspace.count.mockResolvedValue(3);
      try {
        await service.assertCanAddMember('ws-1');
      } catch (e: any) {
        expect(e.response.code).toBe('PLAN_LIMIT_MEMBERS');
      }
    });

    it('always allows adding members on PRO plan (unlimited)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.PRO,
        status: 'active',
      });
      prisma.membreWorkspace.count.mockResolvedValue(999);
      await expect(service.assertCanAddMember('ws-1')).resolves.not.toThrow();
    });
  });

  // ── assertCanCreateDocument ────────────────────────────────────────────────

  describe('assertCanCreateDocument', () => {
    it('allows creating document when under FREE limit (< 10)', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.document.count.mockResolvedValue(9);
      await expect(
        service.assertCanCreateDocument('ws-1'),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when FREE plan document limit is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.document.count.mockResolvedValue(10);
      await expect(service.assertCanCreateDocument('ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when PRO plan document limit (100) is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.PRO,
        status: 'active',
      });
      prisma.document.count.mockResolvedValue(100);
      await expect(service.assertCanCreateDocument('ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('never blocks on ENTERPRISE plan (unlimited documents)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.ENTERPRISE,
        status: 'active',
      });
      prisma.document.count.mockResolvedValue(99999);
      await expect(
        service.assertCanCreateDocument('ws-1'),
      ).resolves.not.toThrow();
    });
  });

  // ── assertCanUseAi ────────────────────────────────────────────────────────

  describe('assertCanUseAi', () => {
    it('allows AI usage when under FREE daily limit (< 10)', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.aiUsage.findUnique.mockResolvedValue({ count: 9 });
      await expect(
        service.assertCanUseAi('user-1', 'ws-1'),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when FREE daily AI limit is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.aiUsage.findUnique.mockResolvedValue({ count: 10 });
      await expect(service.assertCanUseAi('user-1', 'ws-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('treats missing aiUsage record as 0 usage', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.aiUsage.findUnique.mockResolvedValue(null); // no record yet
      await expect(
        service.assertCanUseAi('user-1', 'ws-1'),
      ).resolves.not.toThrow();
    });

    it('allows unlimited AI usage on PRO plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: Plan.PRO,
        status: 'active',
      });
      await expect(
        service.assertCanUseAi('user-1', 'ws-1'),
      ).resolves.not.toThrow();
      expect(prisma.aiUsage.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── incrementAiUsage ──────────────────────────────────────────────────────

  describe('incrementAiUsage', () => {
    it('upserts aiUsage with increment on existing record', async () => {
      prisma.aiUsage.upsert.mockResolvedValue({});
      await service.incrementAiUsage('user-1', 'ws-1');

      expect(prisma.aiUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { count: { increment: 1 } },
          create: expect.objectContaining({ count: 1 }),
        }),
      );
    });

    it('uses today\'s date in YYYY-MM-DD format', async () => {
      prisma.aiUsage.upsert.mockResolvedValue({});
      await service.incrementAiUsage('user-1', 'ws-1');

      const today = new Date().toISOString().split('T')[0];
      const upsertArg = prisma.aiUsage.upsert.mock.calls[0][0];
      expect(upsertArg.where.userId_workspaceId_date.date).toBe(today);
    });
  });

  // ── getBillingPortalUrl ────────────────────────────────────────────────────

  describe('getBillingPortalUrl', () => {
    it('throws NotFoundException when workspace does not exist', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      await expect(
        service.getBillingPortalUrl('user-1', 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the workspace owner', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        proprietaireId: 'other-user',
        subscription: { stripeCustomerId: 'cus_123' },
      });
      await expect(
        service.getBillingPortalUrl('user-1', 'ws-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when no stripe customer exists', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        proprietaireId: 'user-1',
        subscription: null,
      });
      await expect(
        service.getBillingPortalUrl('user-1', 'ws-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns billing portal URL from stripe', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        proprietaireId: 'user-1',
        subscription: { stripeCustomerId: 'cus_123' },
      });
      stripe.createBillingPortalSession.mockResolvedValue(
        'https://billing.stripe.com/session/xyz',
      );

      const url = await service.getBillingPortalUrl('user-1', 'ws-1');
      expect(url).toBe('https://billing.stripe.com/session/xyz');
    });
  });
});