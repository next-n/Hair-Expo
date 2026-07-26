import Stripe from 'stripe';
import { AuditService } from '../src/audit/audit.service';
import { DatabaseService } from '../src/database/database.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { StripeWebhookService } from '../src/webhooks/stripe-webhook.service';

describe('Stripe webhook processing', () => {
  let database: DatabaseService;
  let service: StripeWebhookService;
  let paymentProvider: FakePaymentProvider;
  const secret = 'whsec_test_secret';
  const orderId = 'order-webhook-test';

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    database = new DatabaseService(':memory:'); database.onModuleInit();
    database.connection.prepare(`INSERT INTO orders (id, order_number, status, currency, total_amount_minor, created_at, updated_at) VALUES (?, ?, 'pending', 'USD', 100, ?, ?)`).run(orderId, 'EXPO-WEBHOOK', new Date().toISOString(), new Date().toISOString());
    paymentProvider = new FakePaymentProvider();
    service = new StripeWebhookService(database, new AuditService(database), paymentProvider);
  });
  afterEach(() => { database.onModuleDestroy(); delete process.env.STRIPE_WEBHOOK_SECRET; });

  function signedPayload() {
    const payload = JSON.stringify({ id: 'evt_test_webhook', object: 'event', api_version: '2024-06-20', created: 1, data: { object: { id: 'cs_test_123', object: 'checkout.session', livemode: false, payment_status: 'paid', metadata: { orderId }, payment_intent: 'pi_test_123', payment_link: 'plink_test_123' } }, livemode: false, pending_webhooks: 1, type: 'checkout.session.completed' });
    return { raw: Buffer.from(payload), signature: Stripe.webhooks.generateTestHeaderString({ payload, secret }) };
  }

  it('rejects invalid signatures and makes duplicate paid events harmless', async () => {
    await expect(service.handle(Buffer.from('{}'), 'bad')).rejects.toThrow('Invalid Stripe webhook signature');
    const signed = signedPayload();
    await expect(service.handle(signed.raw, signed.signature)).resolves.toEqual({ received: true, processed: true });
    expect(paymentProvider.deactivationCount).toBe(1);
    await expect(service.handle(signed.raw, signed.signature)).resolves.toEqual({ received: true, duplicate: true });
    expect(paymentProvider.deactivationCount).toBe(1);
    expect(database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId)).toEqual({ status: 'paid' });
    const auditActions = database.connection.prepare('SELECT action FROM audit_records WHERE entity_id = ?').all(orderId);
    expect(auditActions).toHaveLength(2);
    expect(auditActions).toEqual(expect.arrayContaining([
      { action: 'ORDER_PAID' },
      { action: 'PAYMENT_LINK_DEACTIVATED' },
    ]));
    expect(database.connection.prepare('SELECT stripe_payment_link_deactivated_at IS NOT NULL AS deactivated FROM orders WHERE id = ?').get(orderId)).toEqual({ deactivated: 1 });
  });
});
