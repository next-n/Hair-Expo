import { Module } from '@nestjs/common';
import { CheckoutIntakeController } from './checkout-intake.controller';
import { CheckoutIntakeService } from './checkout-intake.service';
import { BoothSessionService } from './booth-session.service';

@Module({ controllers: [CheckoutIntakeController], providers: [CheckoutIntakeService, BoothSessionService], exports: [CheckoutIntakeService, BoothSessionService] })
export class CheckoutIntakeModule {}
