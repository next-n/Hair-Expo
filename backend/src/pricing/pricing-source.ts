import { PricingItemInput } from './pricing-rule';

export interface BasePriceSource {
  getBaseUnitPriceMinor(item: Omit<PricingItemInput, 'baseUnitPriceMinor'>): number;
}

export const BASE_PRICE_SOURCE = Symbol('BASE_PRICE_SOURCE');
