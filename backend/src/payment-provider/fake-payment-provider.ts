import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CheckoutResult, CreateCheckoutInput, PaymentProvider } from './payment-provider';

export type FakeProviderMode = 'success' | 'timeout' | 'failure';

@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  callCount = 0;
  private readonly results = new Map<string, CheckoutResult>();

  constructor(private readonly mode: FakeProviderMode = 'success') {}

  async createCheckout(request: CreateCheckoutInput): Promise<CheckoutResult> {
    this.callCount += 1;
    if (this.mode === 'timeout') throw new Error('FAKE_PROVIDER_TIMEOUT');
    if (this.mode === 'failure') return { status: 'failed', errorCode: 'FAKE_PROVIDER_FAILURE', errorMessage: 'Simulated provider failure' };
    const existing = this.results.get(request.providerIdempotencyKey);
    if (existing) return existing;
    const stableId = createHash('sha256').update(request.providerIdempotencyKey).digest('hex').slice(0, 24);
    const result: CheckoutResult = {
      status: 'created',
      providerReference: `fake_${stableId}`,
      checkoutUrl: `https://fake-payments.invalid/checkout/${stableId}`,
    };
    this.results.set(request.providerIdempotencyKey, result);
    return result;
  }

  async retrieveCheckout(reference: string): Promise<CheckoutResult> {
    for (const result of this.results.values()) {
      if (result.providerReference === reference) return result;
    }
    return { status: 'failed', errorCode: 'NOT_FOUND', errorMessage: 'Fake checkout not found' };
  }
}
