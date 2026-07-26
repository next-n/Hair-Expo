import { Module } from '@nestjs/common';
import { FakePaymentProvider } from './fake-payment-provider';
import { PAYMENT_PROVIDER } from './payment-provider';
import { StripePaymentProvider } from './stripe-payment-provider';

export const STRIPE_PROVIDER = Symbol('STRIPE_PROVIDER');

@Module({
  providers: [
    { provide: FakePaymentProvider, useFactory: () => new FakePaymentProvider() },
    { provide: STRIPE_PROVIDER, useFactory: () => process.env.PAYMENT_PROVIDER === 'fake' ? null : new StripePaymentProvider() },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (fake: FakePaymentProvider, stripe: StripePaymentProvider | null) => stripe ?? fake,
      inject: [FakePaymentProvider, STRIPE_PROVIDER],
    },
  ],
  exports: [FakePaymentProvider, PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
