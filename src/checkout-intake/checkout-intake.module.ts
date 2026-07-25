import { Module } from '@nestjs/common';
import { CheckoutIntakeController } from './checkout-intake.controller';
import { CheckoutIntakeService } from './checkout-intake.service';

@Module({ controllers: [CheckoutIntakeController], providers: [CheckoutIntakeService], exports: [CheckoutIntakeService] })
export class CheckoutIntakeModule {}
