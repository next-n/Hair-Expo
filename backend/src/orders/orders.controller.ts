import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { OrderPreviewDto } from './order-preview.dto';
import { OrdersService } from './orders.service';
import { PasscodeGuard } from '../auth/auth.guard';

type OrderStatusFilter = 'paid' | 'pending' | 'all';

@Controller('orders')
@UseGuards(PasscodeGuard)
export class OrdersController {
  constructor(private readonly pricing: PricingService, private readonly orders: OrdersService) {}

  @Get()
  list(@Query('status') status: OrderStatusFilter = 'all', @Query('from') from?: string, @Query('to') to?: string) {
    if (!['paid', 'pending', 'all'].includes(status)) throw new BadRequestException('Invalid order status filter');
    return this.orders.list(status, from, to);
  }

  @Get(':orderId')
  get(@Param('orderId') orderId: string) { return this.orders.get(orderId); }

  @Post(':orderId/refresh')
  refresh(@Param('orderId') orderId: string) { return this.orders.refresh(orderId); }

  @Post('preview')
  preview(@Body() draft: OrderPreviewDto) {
    return this.pricing.calculate({ currency: draft.currency, expoDiscountEnabled: draft.expoDiscountEnabled, items: draft.items.map((item, index) => ({ itemRef: `item-${index + 1}`, ...item })) });
  }
}
