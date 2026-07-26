import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly stripeWebhook: StripeWebhookService) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(@Req() request: RawRequest, @Headers('stripe-signature') signature?: string) {
    return this.stripeWebhook.handle(request.rawBody ?? Buffer.from(''), signature);
  }
}
