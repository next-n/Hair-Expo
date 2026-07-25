export type Product = { id: string; name: string; productType: string; tags: string[]; variants: Array<{ id: string; name: string; sku: string }> };
export type CartItem = { productId: string; variantId: string; quantity: number; weightGrams?: number; color?: string; lengthInches?: number };
export type PricePreview = { currency: string; subtotalMinor: number; totalMinor: number; adjustments: Array<{ code: string; label: string; type: string; amountMinor: number }>; ruleVersion: string };
export type CheckoutResponse = { operationId: string; status: string; totalAmountMinor: number | null; currency: string | null; checkoutUrl: string | null };
