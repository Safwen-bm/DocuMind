import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { PlansService } from './plans.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('plans')
export class PlansController {
  constructor(
    private plans: PlansService,
    private stripe: StripeService,
    private prisma: PrismaService,
  ) {}

  // ── Get current usage for a workspace ────────────────────────────────────
  @UseGuards(JwtGuard)
  @Get('usage/:workspaceId')
  getUsage(@Req() req: any, @Param('workspaceId') workspaceId: string) {
    return this.plans.getUsage(req.user.id, workspaceId);
  }

  // ── Create Stripe checkout session ───────────────────────────────────────
  @UseGuards(JwtGuard)
  @Post('checkout')
  async createCheckout(
    @Req() req: any,
    @Body() body: { workspaceId: string; plan: 'PRO' | 'ENTERPRISE' },
  ) {
    const priceId =
      body.plan === 'PRO'
        ? process.env.STRIPE_PRO_PRICE_ID!
        : process.env.STRIPE_ENTERPRISE_PRICE_ID!;

    // Fetch user email so Stripe pre-fills it — no need to type it again
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });

    const url = await this.stripe.createCheckoutSession({
      workspaceId: body.workspaceId,
      userId: req.user.id,
      priceId,
      plan: body.plan,
      customerEmail: user?.email,
    });

    return { url };
  }

  // ── Open Stripe billing portal (manage/cancel) ────────────────────────────
  @UseGuards(JwtGuard)
  @Post('billing-portal')
  async billingPortal(@Req() req: any, @Body() body: { workspaceId: string }) {
    const url = await this.plans.getBillingPortalUrl(
      req.user.id,
      body.workspaceId,
    );
    return { url };
  }

  // ── Stripe webhook — NO JwtGuard, Stripe signs this itself ───────────────
  @Post('webhook')
  async webhook(
    @Req() req: any,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const payload = req.body;
      const event = this.stripe.constructWebhookEvent(payload, signature);
      await this.plans.handleStripeEvent(event);
      res.json({ received: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook error:', message);
      res.status(400).send(`Webhook Error: ${message}`);
    }
  }
}