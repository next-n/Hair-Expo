import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuditModule } from '../audit/audit.module';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [PricingModule, AuditModule, PaymentProviderModule, AuthModule], controllers: [OrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
