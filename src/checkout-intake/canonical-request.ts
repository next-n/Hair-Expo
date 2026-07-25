import { createHash } from 'node:crypto';
import { CheckoutIntakeRequestDto } from './checkout-intake.dto';

export type CanonicalCheckoutRequest = {
  currency: string;
  items: Array<{ productId: string; quantity: number }>;
};

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObjectKeys(nested)]));
  }
  return value;
}

export function buildCanonicalCheckoutRequest(request: CheckoutIntakeRequestDto): CanonicalCheckoutRequest {
  return {
    currency: request.currency.toUpperCase(),
    items: request.items.map(({ productId, quantity }) => ({ productId, quantity })),
  };
}

export function canonicalJson(request: CanonicalCheckoutRequest): string {
  return JSON.stringify(sortObjectKeys(request));
}

export function checkoutRequestHash(canonicalRequestJson: string): string {
  return createHash('sha256').update(canonicalRequestJson, 'utf8').digest('hex');
}
