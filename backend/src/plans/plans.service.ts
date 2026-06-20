// backend\src\plans\plans.service.ts

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';
import { StripeService } from './stripe.service';

// ── Plan limits ───────────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  FREE: {
    membersPerWorkspace: 3,
    documentsTotal: 10,
    aiQuestionsPerDay: 10,
  },
  PRO: {
    membersPerWorkspace: Infinity,
    documentsTotal: 100,
    aiQuestionsPerDay: Infinity,
  },
  ENTERPRISE: {
    membersPerWorkspace: Infinity,
    documentsTotal: Infinity,
    aiQuestionsPerDay: Infinity,
  },
} satisfies Record<Plan, Record<string, number>>;

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  // ── Get the plan for a workspace (FREE if no subscription) ────────────────
  async getWorkspacePlan(workspaceId: string): Promise<Plan> {
    const sub = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { plan: true, status: true },
    });
    // No subscription OR inactive → FREE
    if (!sub || sub.status !== 'active') return Plan.FREE;
    return sub.plan;
  }

  // ── Check: can this user create another workspace? ────────────────────────
  async assertCanCreateWorkspace(userId: string): Promise<void> {
    const ownedCount = await this.prisma.workspace.count({
      where: { proprietaireId: userId },
    });

    if (ownedCount >= 1) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_WORKSPACES',
        current: ownedCount,
        message: `You already have a workspace. Creating additional workspaces requires a Pro or Enterprise plan.`,
      });
    }
  }

  // ── Check: can this workspace accept another member? ─────────────────────
  async assertCanAddMember(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = PLAN_LIMITS[plan].membersPerWorkspace;
    if (limit === Infinity) return;

    // ── Only count ACTIVE members — soft-deleted ones don't occupy a seat ──
    const current = await this.prisma.membreWorkspace.count({
      where: { workspaceId, estRetire: false },
    });

    if (current >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_MEMBERS',
        plan,
        limit,
        current,
        message: `Free plan allows ${limit} members per workspace. Upgrade to Pro for unlimited members.`,
      });
    }
  }

  // ── Check: can this workspace hold another document? ─────────────────────
  async assertCanCreateDocument(workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = PLAN_LIMITS[plan].documentsTotal;
    if (limit === Infinity) return;

    const current = await this.prisma.document.count({
      where: { workspaceId, estArchive: false },
    });

    if (current >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_DOCUMENTS',
        plan,
        limit,
        current,
        message:
          plan === Plan.FREE
            ? `Free plan allows ${limit} documents. Upgrade to Pro for up to 100.`
            : `Pro plan allows ${limit} documents. Upgrade to Enterprise for unlimited.`,
      });
    }
  }

  // ── Check: can this user ask the AI today? ────────────────────────────────
  async assertCanUseAi(userId: string, workspaceId: string): Promise<void> {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limit = PLAN_LIMITS[plan].aiQuestionsPerDay;
    if (limit === Infinity) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const usage = await this.prisma.aiUsage.findUnique({
      where: { userId_workspaceId_date: { userId, workspaceId, date: today } },
      select: { count: true },
    });

    const current = usage?.count ?? 0;
    if (current >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_AI',
        plan,
        limit,
        current,
        message: `You've used all ${limit} AI questions for today on the Free plan. Upgrade to Pro for unlimited AI.`,
      });
    }
  }

  // ── Increment AI usage counter (call after a successful AI response) ──────
  async incrementAiUsage(userId: string, workspaceId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.prisma.aiUsage.upsert({
      where: { userId_workspaceId_date: { userId, workspaceId, date: today } },
      create: { userId, workspaceId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  // ── Get current usage info (for the frontend to display) ─────────────────
  async getUsage(userId: string, workspaceId: string) {
    const plan = await this.getWorkspacePlan(workspaceId);
    const limits = PLAN_LIMITS[plan];
    const today = new Date().toISOString().split('T')[0];

    const [ownedWorkspaceCount, memberCount, documentCount, aiUsage] =
      await Promise.all([
        this.prisma.workspace.count({ where: { proprietaireId: userId } }),
        // ── Only count ACTIVE members for the usage display ────────────────
        this.prisma.membreWorkspace.count({
          where: { workspaceId, estRetire: false },
        }),
        this.prisma.document.count({
          where: { workspaceId, estArchive: false },
        }),
        this.prisma.aiUsage.findUnique({
          where: {
            userId_workspaceId_date: { userId, workspaceId, date: today },
          },
          select: { count: true },
        }),
      ]);

    return {
      plan,
      ownedWorkspaces: ownedWorkspaceCount,
      members: {
        current: memberCount,
        limit: limits.membersPerWorkspace,
        isUnlimited: limits.membersPerWorkspace === Infinity,
      },
      documents: {
        current: documentCount,
        limit: limits.documentsTotal,
        isUnlimited: limits.documentsTotal === Infinity,
      },
      aiToday: {
        current: aiUsage?.count ?? 0,
        limit: limits.aiQuestionsPerDay,
        isUnlimited: limits.aiQuestionsPerDay === Infinity,
      },
    };
  }

  // ── Handle incoming Stripe webhook events ────────────────────────────────
  async handleStripeEvent(
    event: ReturnType<StripeService['constructWebhookEvent']>,
  ): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const { workspaceId, plan } = session.metadata!;

        await this.prisma.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan: plan as any,
            status: 'active',
          },
          update: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan: plan as any,
            status: 'active',
          },
        });

        console.log(`Workspace ${workspaceId} upgraded to ${plan}`);
        break;
      }

      // ── Subscription updated (plan change, renewal) ──────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }

      // ── Subscription cancelled/deleted → downgrade to FREE ───────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'cancelled', plan: 'FREE' },
        });
        break;
      }
    }
  }

  // ── Get billing portal URL for workspace owner ───────────────────────────
  async getBillingPortalUrl(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace) throw new NotFoundException('Workspace introuvable.');
    if (workspace.proprietaireId !== userId) {
      throw new ForbiddenException(
        'Only the workspace owner can manage billing.',
      );
    }
    if (!workspace.subscription?.stripeCustomerId) {
      throw new ForbiddenException('No active subscription found.');
    }

    return this.stripeService.createBillingPortalSession(
      workspace.subscription.stripeCustomerId,
      workspaceId,
    );
  }
}