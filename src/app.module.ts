import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { CatalogModule } from './catalog/catalog.module';
import { CheckoutCoreModule } from './checkout-core/checkout-core.module';
import { CheckoutIntakeModule } from './checkout-intake/checkout-intake.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentProviderModule } from './payment-provider/payment-provider.module';
import { PricingModule } from './pricing/pricing.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    DatabaseModule.forRoot(process.env.DATABASE_PATH ?? './data/hair-expo.sqlite'),
    CatalogModule,
    OrdersModule,
    PricingModule,
    CheckoutIntakeModule,
    CheckoutCoreModule,
    PaymentProviderModule,
    WebhooksModule,
    AuditModule,
  ],
})
export class AppModule {}
