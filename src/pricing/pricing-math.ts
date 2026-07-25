export type RoundingMode = 'FLOOR' | 'CEIL' | 'HALF_UP';

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
}

export function roundInteger(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator <= 0n) throw new Error('Rounding denominator must be positive');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (mode === 'FLOOR' || remainder === 0n) return quotient;
  if (mode === 'CEIL') return quotient + 1n;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function percentageAmountMinor(baseMinor: number, basisPoints: number, mode: RoundingMode): number {
  assertNonNegativeInteger(baseMinor, 'baseMinor');
  assertNonNegativeInteger(basisPoints, 'basisPoints');
  const amount = roundInteger(BigInt(baseMinor) * BigInt(basisPoints), 10000n, mode);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Percentage result exceeds safe integer range');
  return Number(amount);
}
