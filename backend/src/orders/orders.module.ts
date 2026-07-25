import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';

@Module({ imports: [PricingModule], controllers: [OrdersController] })
export class OrdersModule {}
