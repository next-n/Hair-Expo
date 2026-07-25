import { Module } from '@nestjs/common';
import { FakePaymentProvider } from './fake-payment-provider';
import { PAYMENT_PROVIDER } from './payment-provider';

@Module({
  providers: [
    { provide: FakePaymentProvider, useFactory: () => new FakePaymentProvider() },
    { provide: PAYMENT_PROVIDER, useExisting: FakePaymentProvider },
  ],
  exports: [FakePaymentProvider, PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
