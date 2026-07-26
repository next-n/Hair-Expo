import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasscodeGuard } from './auth.guard';

@Module({ controllers: [AuthController], providers: [AuthService, PasscodeGuard], exports: [AuthService, PasscodeGuard] })
export class AuthModule {}
