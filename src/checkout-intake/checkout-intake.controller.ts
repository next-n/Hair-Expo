import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, Body } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CheckoutIntakeRequestDto } from './checkout-intake.dto';
import { CheckoutIntakeService } from './checkout-intake.service';

@Controller('checkout-intake')
export class CheckoutIntakeController {
  constructor(private readonly intakeService: CheckoutIntakeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  intake(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-actor-id') actorId: string | undefined,
    @Body() request: CheckoutIntakeRequestDto,
  ) {
    if (!idempotencyKey || !isUUID(idempotencyKey, '4')) {
      throw new BadRequestException('Idempotency-Key must be a UUID v4');
    }
    return this.intakeService.intake(actorId?.trim() || 'anonymous', idempotencyKey, request);
  }
}
