import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StripeWebhookService {
  constructor(private readonly database: DatabaseService, private readonly audit: AuditService) {}

  handle(rawBody: Buffer, signature: string | undefined) {
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
    const now = new Date().toISOString();
    const processed = this.database.connection.transaction(() => {
      const inserted = this.database.connection.prepare(`
        INSERT INTO processed_webhook_events (id, provider_name, provider_event_id, event_type, payload_json, processed_at, checkout_session_id, payment_intent_id, payment_link_id, payment_status)
        VALUES (?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider_name, provider_event_id) DO NOTHING
      `).run(event.id, event.id, event.type, JSON.stringify(event), now, session.id, paymentIntentId, paymentLinkId, session.payment_status);
      if (inserted.changes === 0) return false;
      const before = this.database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
      if (!before) return false;
      if (before.status !== 'paid') {
        this.database.connection.prepare(`UPDATE orders SET status = 'paid', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), stripe_payment_link_id = COALESCE(?, stripe_payment_link_id), updated_at = ? WHERE id = ? AND status IN ('pending', 'review_required')`).run(session.id, paymentIntentId, paymentLinkId, now, orderId);
        this.audit.record({ action: 'ORDER_PAID', entityType: 'order', entityId: orderId, source: 'stripe_webhook', before, after: { status: 'paid' }, metadata: { checkoutSessionId: session.id, paymentIntentId, paymentLinkId } });
      }
      return true;
    })();
    if (!processed) return { received: true, duplicate: true };
    return { received: true, processed: true };
  }
}
