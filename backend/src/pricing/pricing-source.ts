import { PricingItemInput } from './pricing-rule';

export interface BasePriceSource {
  getBaseUnitPriceMinor(item: Omit<PricingItemInput, 'baseUnitPriceMinor'>): number;
  getBasePrice?(item: Omit<PricingItemInput, 'baseUnitPriceMinor'>): {
    readonly usdMinor: number;
    readonly cnyMinor: number;
    readonly sku?: string;
    readonly line?: string;
    readonly productType?: string;
    readonly lengthIn?: string | null;
    readonly unit?: string;
    readonly packWeightGrams?: number | null;
  };
}

export const BASE_PRICE_SOURCE = Symbol('BASE_PRICE_SOURCE');
