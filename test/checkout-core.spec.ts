import { randomUUID } from 'node:crypto';
import { CheckoutCoreService } from '../src/checkout-core/checkout-core.service';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { CheckoutIntakeRequestDto } from '../src/checkout-intake/checkout-intake.dto';
import { DatabaseService } from '../src/database/database.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { MockPricingRule } from '../src/pricing/mock-pricing-rule';

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
    core = new CheckoutCoreService(database, new MockPricingRule(), paymentProvider);
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
      .toEqual(expect.objectContaining({ status: 'completed', provider_idempotency_key: `checkout:${operation.id}:attempt:1`, checkout_url: result.checkoutUrl }));
  });

  it('returns the same URL on retry without calling the provider again', async () => {
    const operation = createOperation();
    const first = await core.process(operation.id);
    const retry = await core.process(operation.id);
    expect(retry).toEqual(first);
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
});
