import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CheckoutCoreService } from './checkout-core.service';
import { PasscodeGuard } from '../auth/auth.guard';

@Controller('checkout')
@UseGuards(PasscodeGuard)
export class CheckoutCoreController {
  constructor(private readonly checkoutCore: CheckoutCoreService) {}

  @Post(':operationId/process')
  @HttpCode(HttpStatus.OK)
  process(@Param('operationId') operationId: string) {
    return this.checkoutCore.process(operationId);
  }

  @Get(':operationId')
  get(@Param('operationId') operationId: string) {
    return this.checkoutCore.get(operationId);
  }
}
