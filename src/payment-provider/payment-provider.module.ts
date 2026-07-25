import { Module } from '@nestjs/common';
import { FakePaymentProvider } from './fake-payment-provider';

@Module({ providers: [FakePaymentProvider], exports: [FakePaymentProvider] })
export class PaymentProviderModule {}
