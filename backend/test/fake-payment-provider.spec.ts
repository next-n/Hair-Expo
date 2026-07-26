import { randomUUID } from 'node:crypto';
import { CheckoutCoreService } from '../src/checkout-core/checkout-core.service';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { DatabaseService } from '../src/database/database.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { CheckoutResult, CreateCheckoutInput, PaymentProvider } from '../src/payment-provider/payment-provider';
import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { MockPriceSource } from '../src/pricing/mock-price-source';
import { PricingService } from '../src/pricing/pricing.service';

const input: CreateCheckoutInput = {
  paymentAttemptId: 'attempt-1',
  providerIdempotencyKey: 'stable-key',
  amountMinor: 100,
  currency: 'USD',
};

describe('fake payment provider boundary', () => {
  it('returns the same checkout result for the same provider identity', async () => {
    const provider = new FakePaymentProvider();
    const first = await provider.createCheckout(input);
    const retry = await provider.createCheckout(input);
    expect(retry).toEqual(first);
    expect(await provider.retrieveCheckout(first.providerReference!)).toEqual(first);
  });

  it('supports simulated timeout and failure modes', async () => {
    await expect(new FakePaymentProvider('timeout').createCheckout(input)).rejects.toThrow('FAKE_PROVIDER_TIMEOUT');
    await expect(new FakePaymentProvider('failure').createCheckout(input)).resolves.toMatchObject({ status: 'failed' });
  });

  it('calls the provider after the local transaction has committed', async () => {
    const database = new DatabaseService(':memory:');
    database.onModuleInit();
    const intake = new CheckoutIntakeService(database);
    const operation = intake.intake('actor-1', randomUUID(), {
      currency: 'USD',
      items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
    }).operation;
    const provider: PaymentProvider = {
      name: 'probe',
      async createCheckout(request): Promise<CheckoutResult> {
        database.connection.exec('BEGIN');
        database.connection.exec('ROLLBACK');
        return { status: 'created', providerReference: request.providerIdempotencyKey, checkoutUrl: 'https://fake-payments.invalid/probe' };
      },
      async retrieveCheckout(): Promise<CheckoutResult> { return { status: 'failed' }; },
      async deactivateCheckout(): Promise<void> {},
    };
    const core = new CheckoutCoreService(database, new PricingService(new DefaultPricingEngine(), new MockPriceSource()), provider);
    await expect(core.process(operation.id)).resolves.toMatchObject({ status: 'completed' });
    database.onModuleDestroy();
  });
});
