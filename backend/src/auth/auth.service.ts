import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'booth_auth';

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>();

  unlock(passcode: string, clientKey = 'unknown'): boolean {
    if (!process.env.APP_PASSCODE) return true;
    const now = Date.now();
    const windowMs = this.rateLimitWindowMs();
    const maxAttempts = this.rateLimitMaxAttempts();
    const current = this.failedAttempts.get(clientKey);
    const state = current && now - current.windowStartedAt < windowMs
      ? current
      : { count: 0, windowStartedAt: now, blockedUntil: 0 };
    if (state.blockedUntil > now) return false;
    if (passcode === process.env.APP_PASSCODE) {
      this.failedAttempts.delete(clientKey);
      return true;
    }
    state.count += 1;
    if (state.count >= maxAttempts) state.blockedUntil = now + windowMs;
    this.failedAttempts.set(clientKey, state);
    return false;
  }

  cookieValue(): string {
    const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    return `${expires}.${this.sign(String(expires))}`;
  }

  isAuthorized(cookieHeader: string | undefined): boolean {
    if (!process.env.APP_PASSCODE) return true;
    const value = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!value) return false;
    const [expires, signature] = value.split('.');
    if (!expires || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(expires);
    return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  cookieName(): string { return COOKIE; }
  private sign(value: string): string { return createHmac('sha256', process.env.APP_PASSCODE ?? 'development-passcode').update(value).digest('hex'); }

  private rateLimitMaxAttempts(): number {
    const configured = Number.parseInt(process.env.AUTH_MAX_ATTEMPTS ?? '5', 10);
    return Number.isSafeInteger(configured) && configured > 0 ? configured : 5;
  }

  private rateLimitWindowMs(): number {
    const configured = Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? '900', 10);
    return (Number.isSafeInteger(configured) && configured > 0 ? configured : 900) * 1000;
  }
}
