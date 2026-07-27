import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { boothCookieAttributes } from '../src/auth/cookie-options';

describe('booth authentication session', () => {
  const previousPasscode = process.env.APP_PASSCODE;
  const previousMaxAttempts = process.env.AUTH_MAX_ATTEMPTS;
  const previousWindow = process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => { process.env.APP_PASSCODE = 'test-passcode'; });
  afterEach(() => {
    if (previousPasscode === undefined) delete process.env.APP_PASSCODE;
    else process.env.APP_PASSCODE = previousPasscode;
    if (previousMaxAttempts === undefined) delete process.env.AUTH_MAX_ATTEMPTS;
    else process.env.AUTH_MAX_ATTEMPTS = previousMaxAttempts;
    if (previousWindow === undefined) delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
    else process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = previousWindow;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('reports whether the existing auth cookie is still valid', () => {
    const auth = new AuthService();
    const controller = new AuthController(auth);
    const cookie = `${auth.cookieName()}=${auth.cookieValue()}`;

    expect(controller.session(undefined)).toEqual({ required: true, authorized: false, status: 'ready' });
    expect(controller.session(cookie)).toEqual({ required: true, authorized: true, status: 'ready' });
  });

  it('rate-limits failed passcode attempts per client and resets after success', () => {
    process.env.AUTH_MAX_ATTEMPTS = '3';
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '900';
    const auth = new AuthService();

    expect(auth.unlock('wrong', 'client-a')).toBe(false);
    expect(auth.unlock('wrong', 'client-a')).toBe(false);
    expect(auth.unlock('test-passcode', 'client-a')).toBe(true);
    expect(auth.unlock('wrong', 'client-a')).toBe(false);
  });

  it('marks booth cookies Secure in production', () => {
    process.env.NODE_ENV = 'production';
    expect(boothCookieAttributes()).toContain('; Secure');
  });
});
