import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { isUUID } from 'class-validator';
import { BoothSessionService } from './booth-session.service';
import { CheckoutIntakeRequestDto } from './checkout-intake.dto';
import { CheckoutIntakeService } from './checkout-intake.service';
import { PasscodeGuard } from '../auth/auth.guard';

@Controller('checkout-intake')
@UseGuards(PasscodeGuard)
export class CheckoutIntakeController {
  constructor(private readonly intakeService: CheckoutIntakeService, private readonly boothSessions: BoothSessionService) {}

  @Get('session')
  session(@Headers('cookie') cookieHeader: string | undefined, @Res({ passthrough: true }) response: Response) {
    this.setSessionCookie(cookieHeader, response);
    return { status: 'ready' };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  intake(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('cookie') cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Body() request: CheckoutIntakeRequestDto,
  ) {
    if (!idempotencyKey || !isUUID(idempotencyKey, '4')) {
      throw new BadRequestException('Idempotency-Key must be a UUID v4');
    }
    const sessionId = this.setSessionCookie(cookieHeader, response);
    return this.intakeService.intake(sessionId, idempotencyKey, request);
  }

  private setSessionCookie(cookieHeader: string | undefined, response: Response): string {
    const candidate = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith('booth_session_id='))?.split('=')[1];
    const sessionId = this.boothSessions.getOrCreate(candidate);
    response.setHeader('Set-Cookie', `booth_session_id=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    return sessionId;
  }
}
