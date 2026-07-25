import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentProviderRequest, PaymentProviderResult } from './payment-provider';

@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';

  async charge(request: PaymentProviderRequest): Promise<PaymentProviderResult> {
    return { status: 'succeeded', providerReference: `fake_${request.paymentAttemptId}` };
  }
}
