import { Body, Controller, Post } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { OrderPreviewDto } from './order-preview.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly pricing: PricingService) {}

  @Post('preview')
  preview(@Body() draft: OrderPreviewDto) {
    return this.pricing.calculate({ currency: draft.currency, items: draft.items.map((item, index) => ({ itemRef: `item-${index + 1}`, ...item })) });
  }
}
