import { Module } from '@nestjs/common';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { PricingModule } from '../pricing/pricing.module';
import { CheckoutCoreController } from './checkout-core.controller';
import { CheckoutCoreService } from './checkout-core.service';

@Module({
  imports: [PricingModule, PaymentProviderModule],
  controllers: [CheckoutCoreController],
  providers: [CheckoutCoreService],
})
export class CheckoutCoreModule {}
