import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('booth authentication session', () => {
  const previousPasscode = process.env.APP_PASSCODE;

  beforeEach(() => { process.env.APP_PASSCODE = 'test-passcode'; });
  afterEach(() => {
    if (previousPasscode === undefined) delete process.env.APP_PASSCODE;
    else process.env.APP_PASSCODE = previousPasscode;
  });

  it('reports whether the existing auth cookie is still valid', () => {
    const auth = new AuthService();
    const controller = new AuthController(auth);
    const cookie = `${auth.cookieName()}=${auth.cookieValue()}`;

    expect(controller.session(undefined)).toEqual({ required: true, authorized: false, status: 'ready' });
    expect(controller.session(cookie)).toEqual({ required: true, authorized: true, status: 'ready' });
  });
});
