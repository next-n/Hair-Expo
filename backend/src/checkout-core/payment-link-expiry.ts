export const PRODUCTION_PAYMENT_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The production policy is intentionally fixed at 24 hours. The short test
 * override exists only for local/non-production UI verification and is
 * ignored whenever NODE_ENV is production or the Stripe adapter is selected.
 */
export function paymentLinkTtlMs(): number {
  if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_PROVIDER === 'stripe') return PRODUCTION_PAYMENT_LINK_TTL_MS;
  const configuredSeconds = Number(process.env.PAYMENT_LINK_TTL_TEST_SECONDS);
  if (Number.isSafeInteger(configuredSeconds) && configuredSeconds > 0) return configuredSeconds * 1000;
  return PRODUCTION_PAYMENT_LINK_TTL_MS;
}

export function paymentLinkExpiresAt(createdAt: Date): string {
  return new Date(createdAt.getTime() + paymentLinkTtlMs()).toISOString();
}

export function isPaymentLinkExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  return Boolean(expiresAt && Date.parse(expiresAt) <= now);
}
