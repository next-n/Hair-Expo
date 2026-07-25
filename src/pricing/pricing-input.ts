import { PricingItemInput } from './pricing-rule';

export interface NormalizedOrderDraftItem extends Omit<PricingItemInput, 'baseUnitPriceMinor'> {
  readonly baseUnitPriceMinor?: number;
}

export interface NormalizedOrderDraft {
  readonly currency: string;
  readonly items: readonly NormalizedOrderDraftItem[];
}

export interface PriceSnapshot {
  readonly currency: string;
  readonly lines: readonly import('./pricing-rule').PricingLine[];
  readonly subtotalMinor: number;
  readonly adjustments: readonly import('./pricing-rule').PricingAdjustment[];
  readonly totalMinor: number;
  readonly ruleVersion: string;
}
