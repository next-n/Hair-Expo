import { Body, Controller, Get, Headers, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { boothCookieAttributes } from './cookie-options';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('unlock')
  unlock(@Body() body: { passcode?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (!this.auth.unlock(body.passcode ?? '', request.ip ?? request.socket.remoteAddress ?? 'unknown')) throw new UnauthorizedException('Invalid booth passcode');
    response.setHeader('Set-Cookie', `${this.auth.cookieName()}=${this.auth.cookieValue()}; ${boothCookieAttributes()}`);
    return { status: 'ready' };
  }

  @Get('session')
  session(@Headers('cookie') cookieHeader: string | undefined) {
    const required = Boolean(process.env.APP_PASSCODE);
    return { required, authorized: !required || this.auth.isAuthorized(cookieHeader), status: 'ready' };
  }
}
