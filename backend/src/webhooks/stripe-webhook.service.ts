import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payment-provider/payment-provider';

interface OrderPaymentSnapshot {
  status: string;
  currency: string;
  total_amount_minor: number;
  stripe_payment_link_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_link_deactivated_at: string | null;
}

interface WebhookOutcome {
  accepted: boolean;
  duplicate: boolean;
  duplicatePayment: boolean;
  orderId: string;
  paymentLinkId: string | null;
  needsDeactivation: boolean;
}

@Injectable()
export class StripeWebhookService {
  constructor(private readonly database: DatabaseService, private readonly audit: AuditService, @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider) {}

  async handle(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) throw new BadRequestException('Invalid Stripe webhook signature');
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
    if (event.livemode) throw new BadRequestException('Live Stripe events are not accepted');
    if (event.type !== 'checkout.session.completed') return { received: true, ignored: true };
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return { received: true, ignored: true };
    const metadata = session.metadata ?? {};
    const orderId = metadata.orderId;
    if (!orderId) return { received: true, ignored: true };
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
    const paymentLinkId = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link?.id ?? null;
    const knownOrder = this.database.connection.prepare(`
      SELECT status, currency, total_amount_minor, stripe_payment_link_id, stripe_checkout_session_id,
             stripe_payment_intent_id, stripe_payment_link_deactivated_at
      FROM orders WHERE id = ?
    `).get(orderId) as OrderPaymentSnapshot | undefined;
    if (!knownOrder) return { received: true, ignored: true };
    this.assertPaymentMatchesOrder(session.amount_total, session.currency, paymentLinkId, knownOrder);
    const now = new Date().toISOString();
    const outcome: WebhookOutcome = this.database.connection.transaction(() => {
      const order = this.database.connection.prepare(`
        SELECT status, currency, total_amount_minor, stripe_payment_link_id, stripe_checkout_session_id,
               stripe_payment_intent_id, stripe_payment_link_deactivated_at
        FROM orders WHERE id = ?
      `).get(orderId) as OrderPaymentSnapshot | undefined;
      if (!order) return { accepted: false, duplicate: false, duplicatePayment: false, orderId, paymentLinkId, needsDeactivation: false };
      this.assertPaymentMatchesOrder(session.amount_total, session.currency, paymentLinkId, order);
      const inserted = this.database.connection.prepare(`
        INSERT INTO processed_webhook_events (id, provider_name, provider_event_id, event_type, payload_json, processed_at, checkout_session_id, payment_intent_id, payment_link_id, payment_status)
        VALUES (?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider_name, provider_event_id) DO NOTHING
      `).run(event.id, event.id, event.type, JSON.stringify(event), now, session.id, paymentIntentId, paymentLinkId, session.payment_status);
      const linkToDeactivate = paymentLinkId ?? order.stripe_payment_link_id;
      if (inserted.changes === 0) return { accepted: true, duplicate: true, duplicatePayment: false, orderId, paymentLinkId: linkToDeactivate, needsDeactivation: Boolean(linkToDeactivate && !order.stripe_payment_link_deactivated_at) };
      if (order.status === 'paid') {
        const samePayment = order.stripe_checkout_session_id === session.id
          || (paymentIntentId !== null && order.stripe_payment_intent_id === paymentIntentId);
        if (!samePayment) {
          this.audit.record({
            action: 'DUPLICATE_PAYMENT_DETECTED',
            entityType: 'order',
            entityId: orderId,
            source: 'stripe_webhook',
            metadata: {
              review: 'manual_refund_review',
              checkoutSessionId: session.id,
              paymentIntentId,
              paymentLinkId,
              amountMinor: session.amount_total,
              currency: session.currency,
              originalCheckoutSessionId: order.stripe_checkout_session_id,
              originalPaymentIntentId: order.stripe_payment_intent_id,
            },
          });
        }
        return { accepted: true, duplicate: false, duplicatePayment: !samePayment, orderId, paymentLinkId: linkToDeactivate, needsDeactivation: false };
      }
      if (order.status !== 'paid' && ['pending', 'review_required'].includes(order.status)) {
        const updated = this.database.connection.prepare(`UPDATE orders SET status = 'paid', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), stripe_payment_link_id = COALESCE(?, stripe_payment_link_id), updated_at = ? WHERE id = ? AND status IN ('pending', 'review_required')`).run(session.id, paymentIntentId, paymentLinkId, now, orderId);
        if (updated.changes !== 1) throw new Error('Order state changed while processing Stripe payment');
        this.audit.record({ action: 'ORDER_PAID', entityType: 'order', entityId: orderId, source: 'stripe_webhook', before: order, after: { status: 'paid' }, metadata: { checkoutSessionId: session.id, paymentIntentId, paymentLinkId } });
        return { accepted: true, duplicate: false, duplicatePayment: false, orderId, paymentLinkId: linkToDeactivate, needsDeactivation: Boolean(linkToDeactivate && !order.stripe_payment_link_deactivated_at) };
      }
      return { accepted: true, duplicate: false, duplicatePayment: false, orderId, paymentLinkId: linkToDeactivate, needsDeactivation: false };
    })();
    if (!outcome.accepted) return { received: true, ignored: true };
    if (outcome.needsDeactivation && outcome.paymentLinkId) {
      try {
        await this.paymentProvider.deactivateCheckout(outcome.paymentLinkId);
      } catch (error) {
        this.audit.record({ action: 'PAYMENT_LINK_DEACTIVATION_FAILED', entityType: 'order', entityId: outcome.orderId, source: 'stripe_webhook', metadata: { paymentLinkId: outcome.paymentLinkId, error: error instanceof Error ? error.message : 'unknown error' } });
        throw new Error('Stripe payment link deactivation failed');
      }
      this.database.connection.transaction(() => {
        this.database.connection.prepare('UPDATE orders SET stripe_payment_link_deactivated_at = ?, updated_at = ? WHERE id = ? AND stripe_payment_link_deactivated_at IS NULL').run(now, new Date().toISOString(), outcome.orderId);
        this.audit.record({ action: 'PAYMENT_LINK_DEACTIVATED', entityType: 'order', entityId: outcome.orderId, source: 'stripe_webhook', metadata: { paymentLinkId: outcome.paymentLinkId } });
      })();
    }
    if (outcome.duplicatePayment) return { received: true, duplicatePayment: true, manualRefundReview: true };
    return outcome.duplicate ? { received: true, duplicate: true } : { received: true, processed: true };
  }

  private assertPaymentMatchesOrder(amountMinor: number | null, currency: string | null, paymentLinkId: string | null, order: OrderPaymentSnapshot): void {
    const currencyMatches = typeof currency === 'string' && currency.toUpperCase() === order.currency.toUpperCase();
    const amountMatches = amountMinor !== null && amountMinor === order.total_amount_minor;
    const paymentLinkMatches = paymentLinkId !== null && paymentLinkId === order.stripe_payment_link_id;
    if (!amountMatches || !currencyMatches || !paymentLinkMatches) {
      throw new BadRequestException('Stripe payment does not match the local order');
    }
  }
}
