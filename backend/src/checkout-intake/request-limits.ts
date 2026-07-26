function positiveSafeIntegerFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const CHECKOUT_LIMITS = {
  maxItems: 100,
  // Operational request ceiling; this is not a catalog or pricing rule.
  maxQuantity: positiveSafeIntegerFromEnv('CHECKOUT_MAX_QUANTITY', 10_000),
  maxWeightGrams: 100_000,
  maxLengthInches: 100,
  maxColorLength: 50,
} as const;
