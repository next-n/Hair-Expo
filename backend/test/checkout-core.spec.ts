import { randomUUID } from 'node:crypto';
import { CheckoutCoreService } from '../src/checkout-core/checkout-core.service';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { CheckoutIntakeRequestDto } from '../src/checkout-intake/checkout-intake.dto';
import { DatabaseService } from '../src/database/database.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { CheckoutResult, PaymentProvider } from '../src/payment-provider/payment-provider';
import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { MockPriceSource } from '../src/pricing/mock-price-source';
import { PricingService } from '../src/pricing/pricing.service';

describe('first vertical checkout flow', () => {
  let database: DatabaseService;
  let intake: CheckoutIntakeService;
  let paymentProvider: FakePaymentProvider;
  let core: CheckoutCoreService;

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    database.onModuleInit();
    intake = new CheckoutIntakeService(database);
    paymentProvider = new FakePaymentProvider();
    core = new CheckoutCoreService(database, new PricingService(new DefaultPricingEngine(), new MockPriceSource()), paymentProvider);
  });

  afterEach(() => database.onModuleDestroy());

  function createOperation() {
    const request: CheckoutIntakeRequestDto = {
      currency: 'USD',
      items: [{ productId: randomUUID(), quantity: 2 }],
    };
    return intake.intake('actor-1', randomUUID(), request).operation;
  }

  it('claims, prices, commits before payment, and completes with a stable URL', async () => {
    const operation = createOperation();
    const result = await core.process(operation.id);
    expect(result.status).toBe('completed');
    expect(result.totalAmountMinor).toBe(200);
    expect(result.currency).toBe('USD');
    expect(result.checkoutUrl).toMatch(/^https:\/\/fake-payments\.invalid\/checkout\//);
    expect(database.connection.prepare('SELECT status FROM checkout_operations WHERE id = ?').get(operation.id))
      .toEqual({ status: 'completed' });
    expect(database.connection.prepare('SELECT status, provider_idempotency_key, checkout_url FROM checkout_attempts WHERE checkout_operation_id = ?').get(operation.id))
      .toEqual(expect.objectContaining({ status: 'completed', provider_idempotency_key: `trunov:payment-link:${operation.id}`, checkout_url: result.checkoutUrl }));
  });

  it('returns the same URL on retry without calling the provider again', async () => {
    const operation = createOperation();
    const first = await core.process(operation.id);
    const retry = await core.process(operation.id);
    expect(retry).toEqual(first);
    expect(paymentProvider.callCount).toBe(1);
  });

  it('returns the persisted paid status when a completed operation is retried', async () => {
    const operation = createOperation();
    const first = await core.process(operation.id);
    database.connection.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(first.orderId);

    const retry = await core.process(operation.id);

    expect(retry.checkoutUrl).toBe(first.checkoutUrl);
    expect(retry.paymentStatus).toBe('paid');
    expect(paymentProvider.callCount).toBe(1);
  });

  it('allows only one concurrent processor to claim an operation', async () => {
    const operation = createOperation();
    const results = await Promise.allSettled([
      core.process(operation.id),
      core.process(operation.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection).toEqual(expect.objectContaining({ reason: expect.objectContaining({ response: expect.objectContaining({ statusCode: 409 }) }) }));
    expect(paymentProvider.callCount).toBe(1);
  });

  it('reclaims an operation whose processing lease has expired', async () => {
    const operation = createOperation();
    const expired = new Date(Date.now() - 1_000).toISOString();
    database.connection.prepare(`UPDATE checkout_operations
      SET status = 'processing', processing_started_at = ?, processing_lease_until = ?
      WHERE id = ?`).run(expired, expired, operation.id);

    const result = await core.process(operation.id);

    expect(result.status).toBe('completed');
    expect(paymentProvider.callCount).toBe(1);
  });

  it('does not reclaim an operation with an active processing lease', async () => {
    const operation = createOperation();
    const active = new Date(Date.now() + 60_000).toISOString();
    database.connection.prepare(`UPDATE checkout_operations
      SET status = 'processing', processing_started_at = ?, processing_lease_until = ?
      WHERE id = ?`).run(new Date().toISOString(), active, operation.id);

    await expect(core.process(operation.id)).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 409 }),
    });
    expect(paymentProvider.callCount).toBe(0);
  });

  it('also recovers a stale payment-pending operation after a crash window', async () => {
    const operation = createOperation();
    const expired = new Date(Date.now() - 1_000).toISOString();
    database.connection.prepare(`UPDATE checkout_operations
      SET status = 'payment_pending', processing_started_at = ?, processing_lease_until = ?
      WHERE id = ?`).run(expired, expired, operation.id);

    const result = await core.process(operation.id);

    expect(result.status).toBe('completed');
    expect(paymentProvider.callCount).toBe(1);
  });

  it('renews the payment lease while the provider call is still running', async () => {
    jest.useFakeTimers();
    let resolveProvider!: (result: CheckoutResult) => void;
    const blockingProvider: PaymentProvider = {
      name: 'blocking',
      createCheckout: () => new Promise<CheckoutResult>((resolve) => { resolveProvider = resolve; }),
      retrieveCheckout: async () => ({ status: 'failed' }),
      deactivateCheckout: async () => {},
    };
    const blockingCore = new CheckoutCoreService(database, new PricingService(new DefaultPricingEngine(), new MockPriceSource()), blockingProvider);
    const operation = createOperation();

    try {
      const inFlight = blockingCore.process(operation.id);
      const before = database.connection.prepare('SELECT processing_lease_until AS lease FROM checkout_operations WHERE id = ?').get(operation.id) as { lease: string | null };
      jest.advanceTimersByTime(30_000);
      const after = database.connection.prepare('SELECT processing_lease_until AS lease FROM checkout_operations WHERE id = ?').get(operation.id) as { lease: string | null };
      expect(after.lease).not.toBe(before.lease);

      resolveProvider({ status: 'created', providerReference: 'blocking-reference', checkoutUrl: 'https://fake-payments.invalid/blocking' });
      await expect(inFlight).resolves.toMatchObject({ status: 'completed' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('fences a late provider result from a request that lost its lease', async () => {
    const resolvers: Array<(result: CheckoutResult) => void> = [];
    const blockingProvider: PaymentProvider = {
      name: 'blocking',
      createCheckout: () => new Promise<CheckoutResult>((resolve) => { resolvers.push(resolve); }),
      retrieveCheckout: async () => ({ status: 'failed' }),
      deactivateCheckout: async () => {},
    };
    const blockingCore = new CheckoutCoreService(database, new PricingService(new DefaultPricingEngine(), new MockPriceSource()), blockingProvider);
    const operation = createOperation();
    const first = blockingCore.process(operation.id);
    await Promise.resolve();
    const firstLease = database.connection.prepare('SELECT processing_claim_token AS token FROM checkout_operations WHERE id = ?').get(operation.id) as { token: string };
    database.connection.prepare(`UPDATE checkout_operations SET processing_lease_until = ? WHERE id = ?`).run(new Date(Date.now() - 1_000).toISOString(), operation.id);

    const second = blockingCore.process(operation.id);
    await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    resolvers[0]({ status: 'created', providerReference: 'late-reference', checkoutUrl: 'https://fake-payments.invalid/late' });
    await expect(first).rejects.toMatchObject({ response: expect.objectContaining({ statusCode: 409 }) });
    expect(database.connection.prepare('SELECT processing_claim_token AS token FROM checkout_operations WHERE id = ?').get(operation.id)).not.toEqual(firstLease);

    resolvers[1]({ status: 'created', providerReference: 'current-reference', checkoutUrl: 'https://fake-payments.invalid/current' });
    await expect(second).resolves.toMatchObject({ status: 'completed', providerReference: 'current-reference' });
  });
});
