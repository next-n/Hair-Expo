import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CheckoutCoreService } from './checkout-core.service';

@Controller('checkout-core')
export class CheckoutCoreController {
  constructor(private readonly checkoutCore: CheckoutCoreService) {}

  @Post(':operationId/process')
  @HttpCode(HttpStatus.OK)
  process(@Param('operationId') operationId: string) {
    return this.checkoutCore.process(operationId);
  }
}
