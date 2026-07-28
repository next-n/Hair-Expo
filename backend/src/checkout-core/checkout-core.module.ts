import { Module } from '@nestjs/common';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { PricingModule } from '../pricing/pricing.module';
import { CheckoutCoreController } from './checkout-core.controller';
import { CheckoutCoreService } from './checkout-core.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PricingModule, PaymentProviderModule, AuthModule],
  controllers: [CheckoutCoreController],
  providers: [CheckoutCoreService],
  exports: [CheckoutCoreService],
})
export class CheckoutCoreModule {}
