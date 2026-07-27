import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { CheckoutResult, CreateCheckoutInput, PaymentProvider } from './payment-provider';

const STRIPE_API_VERSION = '2024-06-20' as Stripe.LatestApiVersion;

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly stripe: Stripe;

  constructor() {
    const secret = process.env.STRIPE_SECRET_KEY ?? '';
    if (!secret.startsWith('sk_test_')) throw new Error('STRIPE_SECRET_KEY must be a Stripe test-mode key beginning with sk_test_');
    this.stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 0, timeout: 10_000 });
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!input.orderId || !input.orderNumber || !input.operationId) throw new Error('Stripe checkout requires local order identity');
    const metadata = { orderId: input.orderId, orderNumber: input.orderNumber, checkoutOperationId: input.operationId };
    try {
      const product = await this.stripe.products.create({ name: `TRUNOV HAIR Order ${input.orderNumber}`, metadata }, { idempotencyKey: `trunov:product:${input.operationId}` });
      this.assertTestMode(product.livemode);
      const price = await this.stripe.prices.create({ currency: input.currency.toLowerCase(), unit_amount: input.amountMinor, product: product.id, metadata }, { idempotencyKey: `trunov:price:${input.operationId}` });
      this.assertTestMode(price.livemode);
      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata,
        restrictions: { completed_sessions: { limit: 1 } },
        ...(input.frontendUrl ? { after_completion: { type: 'redirect', redirect: { url: `${input.frontendUrl}/orders/${input.orderId}` } } } : {}),
      }, { idempotencyKey: `trunov:payment-link:${input.operationId}` });
      this.assertTestMode(paymentLink.livemode);
      return { status: 'created', providerReference: paymentLink.id, checkoutUrl: paymentLink.url, livemode: paymentLink.livemode, providerProductId: product.id, providerPriceId: price.id, paymentLinkId: paymentLink.id };
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be a Stripe test-mode')) throw error;
      const message = error instanceof Stripe.errors.StripeError ? error.message : 'Stripe payment link creation failed';
      throw new Error(message);
    }
  }

  async retrieveCheckout(reference: string): Promise<CheckoutResult> {
    const link = await this.stripe.paymentLinks.retrieve(reference);
    this.assertTestMode(link.livemode);
    const sessions = await this.stripe.checkout.sessions.list({ payment_link: reference, limit: 10 });
    const session = sessions.data.find((candidate) => candidate.payment_status === 'paid') ?? sessions.data[0];
    return {
      status: session?.payment_status === 'paid' ? 'created' : 'failed',
      providerReference: reference,
      checkoutUrl: link.url,
      livemode: link.livemode,
      paymentLinkId: link.id,
      checkoutSessionId: session?.id,
      paymentIntentId: typeof session?.payment_intent === 'string' ? session.payment_intent : session?.payment_intent?.id,
      amountMinor: session?.amount_total ?? undefined,
      currency: session?.currency?.toUpperCase() ?? undefined,
    };
  }

  async deactivateCheckout(reference: string): Promise<void> {
    const link = await this.stripe.paymentLinks.update(reference, { active: false });
    this.assertTestMode(link.livemode);
  }

  private assertTestMode(livemode: boolean): void {
    if (livemode) throw new Error('Stripe returned a live-mode object while the application requires test mode');
  }
}
