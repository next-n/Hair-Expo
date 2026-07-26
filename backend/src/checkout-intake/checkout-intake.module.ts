import { Module } from '@nestjs/common';
import { CheckoutIntakeController } from './checkout-intake.controller';
import { CheckoutIntakeService } from './checkout-intake.service';
import { BoothSessionService } from './booth-session.service';
import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [CatalogModule, AuthModule], controllers: [CheckoutIntakeController], providers: [CheckoutIntakeService, BoothSessionService], exports: [CheckoutIntakeService, BoothSessionService] })
export class CheckoutIntakeModule {}
