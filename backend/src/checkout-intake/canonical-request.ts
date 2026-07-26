import { createHash } from 'node:crypto';
import { CheckoutIntakeRequestDto } from './checkout-intake.dto';

export type CanonicalCheckoutRequest = {
  currency: string;
  customerName?: string;
  customerContact?: string;
  expoDiscountEnabled: boolean;
  items: Array<{ sku?: string; productId: string; variantId?: string; quantity: number; blonde: boolean; weightGrams?: number; color?: string; lengthInches?: number }>;
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

export function buildCanonicalCheckoutRequest(request: CheckoutIntakeRequestDto, skus?: Array<string | undefined>): CanonicalCheckoutRequest {
  return {
    currency: request.currency.toUpperCase(),
    customerName: request.customerName?.trim() || undefined,
    customerContact: request.customerContact?.trim() || undefined,
    expoDiscountEnabled: request.expoDiscountEnabled !== false,
    items: request.items.map(({ productId, variantId, quantity, blonde, weightGrams, color, lengthInches }, index) => ({
      sku: skus?.[index], productId, variantId, quantity, blonde: blonde === true, weightGrams, color, lengthInches,
    })),
  };
}

export function canonicalJson(request: CanonicalCheckoutRequest): string {
  return JSON.stringify(sortObjectKeys(request));
}

export function checkoutRequestHash(canonicalRequestJson: string): string {
  return createHash('sha256').update(canonicalRequestJson, 'utf8').digest('hex');
}
