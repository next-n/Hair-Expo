import { isPaymentLinkExpired, paymentLinkExpiresAt, PRODUCTION_PAYMENT_LINK_TTL_MS } from '../src/checkout-core/payment-link-expiry';

describe('payment-link expiry policy', () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalTestSeconds = process.env.PAYMENT_LINK_TTL_TEST_SECONDS;
  const originalProvider = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment;
    if (originalTestSeconds === undefined) delete process.env.PAYMENT_LINK_TTL_TEST_SECONDS;
    else process.env.PAYMENT_LINK_TTL_TEST_SECONDS = originalTestSeconds;
    if (originalProvider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = originalProvider;
  });

  it('uses the five-second test policy outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_LINK_TTL_TEST_SECONDS = '5';
    const created = new Date('2026-01-01T00:00:00.000Z');
    const expires = paymentLinkExpiresAt(created);
    expect(Date.parse(expires) - created.getTime()).toBe(5_000);
    expect(isPaymentLinkExpired(expires, Date.parse('2026-01-01T00:00:04.999Z'))).toBe(false);
    expect(isPaymentLinkExpired(expires, Date.parse('2026-01-01T00:00:05.000Z'))).toBe(true);
  });

  it('always uses the fixed 24-hour policy in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_LINK_TTL_TEST_SECONDS = '5';
    const created = new Date('2026-01-01T00:00:00.000Z');
    expect(Date.parse(paymentLinkExpiresAt(created)) - created.getTime()).toBe(PRODUCTION_PAYMENT_LINK_TTL_MS);
  });

  it('does not allow the test override when the Stripe adapter is selected', () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_LINK_TTL_TEST_SECONDS = '5';
    const created = new Date('2026-01-01T00:00:00.000Z');
    expect(Date.parse(paymentLinkExpiresAt(created)) - created.getTime()).toBe(PRODUCTION_PAYMENT_LINK_TTL_MS);
  });
});
