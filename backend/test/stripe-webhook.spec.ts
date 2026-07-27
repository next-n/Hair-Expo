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
    database.connection.prepare(`INSERT INTO orders (id, order_number, status, currency, total_amount_minor, stripe_payment_link_id, created_at, updated_at) VALUES (?, ?, 'pending', 'USD', 100, 'plink_test_123', ?, ?)`).run(orderId, 'EXPO-WEBHOOK', new Date().toISOString(), new Date().toISOString());
    paymentProvider = new FakePaymentProvider();
    service = new StripeWebhookService(database, new AuditService(database), paymentProvider);
  });
  afterEach(() => { database.onModuleDestroy(); delete process.env.STRIPE_WEBHOOK_SECRET; });

  function signedPayload(overrides: Record<string, unknown> = {}) {
    const payload = JSON.stringify({ id: 'evt_test_webhook', object: 'event', api_version: '2024-06-20', created: 1, data: { object: { id: 'cs_test_123', object: 'checkout.session', livemode: false, payment_status: 'paid', amount_total: 100, currency: 'usd', metadata: { orderId }, payment_intent: 'pi_test_123', payment_link: 'plink_test_123', ...overrides } }, livemode: false, pending_webhooks: 1, type: 'checkout.session.completed' });
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

  it.each([
    { label: 'amount', override: { amount_total: 101 } },
    { label: 'currency', override: { currency: 'eur' } },
    { label: 'payment link', override: { payment_link: 'plink_other' } },
  ])('rejects a paid session with a mismatched $label', async ({ override }) => {
    const signed = signedPayload(override);
    await expect(service.handle(signed.raw, signed.signature)).rejects.toThrow('does not match the local order');
    expect(database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId)).toEqual({ status: 'pending' });
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM processed_webhook_events').get()).toEqual({ count: 0 });
    expect(paymentProvider.deactivationCount).toBe(0);
  });

  it('records a second real payment for manual refund review without reapplying the order payment', async () => {
    const first = signedPayload();
    await service.handle(first.raw, first.signature);
    const secondPayload = JSON.stringify({ id: 'evt_second_payment', object: 'event', api_version: '2024-06-20', created: 2, data: { object: { id: 'cs_test_456', object: 'checkout.session', livemode: false, payment_status: 'paid', amount_total: 100, currency: 'usd', metadata: { orderId }, payment_intent: 'pi_test_456', payment_link: 'plink_test_123' } }, livemode: false, pending_webhooks: 1, type: 'checkout.session.completed' });
    const secondSigned = { raw: Buffer.from(secondPayload), signature: Stripe.webhooks.generateTestHeaderString({ payload: secondPayload, secret }) };
    await expect(service.handle(secondSigned.raw, secondSigned.signature)).resolves.toEqual({ received: true, duplicatePayment: true, manualRefundReview: true });
    expect(paymentProvider.deactivationCount).toBe(1);
    expect(database.connection.prepare('SELECT status, stripe_checkout_session_id FROM orders WHERE id = ?').get(orderId)).toEqual({ status: 'paid', stripe_checkout_session_id: 'cs_test_123' });
    expect(database.connection.prepare('SELECT action, metadata_json FROM audit_records WHERE action = ?').get('DUPLICATE_PAYMENT_DETECTED')).toMatchObject({ action: 'DUPLICATE_PAYMENT_DETECTED' });
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM processed_webhook_events').get()).toEqual({ count: 2 });
  });
});
