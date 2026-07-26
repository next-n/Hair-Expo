import { PricingItemInput, PricingResult } from './pricing-rule';

export interface NormalizedOrderDraftItem extends Omit<PricingItemInput, 'baseUnitPriceMinor'> {
  readonly baseUnitPriceMinor?: number;
}

export interface NormalizedOrderDraft {
  readonly currency: string;
  readonly items: readonly NormalizedOrderDraftItem[];
  readonly expoDiscountEnabled?: boolean;
}

export type PriceSnapshot = PricingResult;
