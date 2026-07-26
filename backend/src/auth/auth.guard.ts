import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class PasscodeGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { cookie?: string } }>();
    if (!this.auth.isAuthorized(request.headers.cookie)) throw new UnauthorizedException('Booth passcode required');
    return true;
  }
}
