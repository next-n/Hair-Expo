import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PaymentProvider, PaymentProviderRequest, PaymentProviderResult } from './payment-provider';

@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  callCount = 0;

  async createCheckoutSession(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
    this.callCount += 1;
    const stableId = createHash('sha256').update(request.providerIdempotencyKey).digest('hex').slice(0, 24);
    return {
      status: 'created',
      providerReference: `fake_${stableId}`,
      checkoutUrl: `https://fake-payments.invalid/checkout/${stableId}`,
    };
  }
}
