import { Body, Controller, Get, Post, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('unlock')
  unlock(@Body() body: { passcode?: string }, @Res({ passthrough: true }) response: Response) {
    if (!this.auth.unlock(body.passcode ?? '')) throw new UnauthorizedException('Invalid booth passcode');
    response.setHeader('Set-Cookie', `${this.auth.cookieName()}=${this.auth.cookieValue()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    return { status: 'ready' };
  }

  @Get('session')
  session() { return { required: Boolean(process.env.APP_PASSCODE), status: 'ready' }; }
}
