import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'booth_auth';

@Injectable()
export class AuthService {
  unlock(passcode: string): boolean { return !process.env.APP_PASSCODE || passcode === process.env.APP_PASSCODE; }

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
}
