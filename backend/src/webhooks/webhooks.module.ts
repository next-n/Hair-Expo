import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { OrdersModule } from '../orders/orders.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentProviderModule } from '../payment-provider/payment-provider.module';

@Module({ imports: [OrdersModule, AuditModule, PaymentProviderModule], controllers: [WebhooksController], providers: [StripeWebhookService] })
export class WebhooksModule {}
