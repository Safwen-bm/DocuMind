import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

@Injectable()
export class StripeService {
  public stripe: any;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  async createCheckoutSession(params: {
    workspaceId: string;
    userId: string;
    priceId: string;
    plan: 'PRO' | 'ENTERPRISE';
    customerEmail?: string; // ← pre-fills the Stripe checkout form
  }): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      // Pre-fill email so the user doesn't have to type it again
      ...(params.customerEmail && { customer_email: params.customerEmail }),
      success_url: `${process.env.FRONTEND_URL}/en/workspace/${params.workspaceId}?upgraded=true`,
      cancel_url: `${process.env.FRONTEND_URL}/en/pricing?cancelled=true`,
      metadata: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        plan: params.plan,
      },
    });
    return session.url!;
  }

  async createBillingPortalSession(
    stripeCustomerId: string,
    workspaceId: string,
  ): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/en/workspace/${workspaceId}/settings`,
    });
    return session.url;
  }

  constructWebhookEvent(payload: Buffer, signature: string): any {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  }
}