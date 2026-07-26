export type PricingAdjustmentType = 'SURCHARGE' | 'DISCOUNT';
export type PricingAdjustmentScope = 'ITEM' | 'ORDER';
export type PricingRuleScope = PricingAdjustmentScope | 'BOTH';

export interface PricingItemInput {
  readonly itemRef: string;
  readonly productId: string;
  readonly variantId?: string;
  readonly quantity: number;
  readonly weightGrams?: number;
  readonly color?: string;
  readonly lengthInches?: number;
  readonly baseUnitPriceMinor: number;
  readonly baseUnitPriceCnyMinor?: number;
  readonly blonde?: boolean;
  readonly sku?: string;
  readonly line?: string;
  readonly productType?: string;
  readonly lengthIn?: string | null;
  readonly unit?: string;
  readonly packWeightGrams?: number | null;
  readonly productTags?: readonly string[];
}

export interface PricingInput {
  readonly currency: string;
  readonly items: readonly PricingItemInput[];
  readonly expoDiscountEnabled?: boolean;
}

export interface PricingLine {
  readonly itemRef: string;
  readonly productId: string;
  readonly variantId?: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly unitPriceCnyMinor: number;
  readonly baseUnitPriceMinor: number;
  readonly baseUnitPriceCnyMinor: number;
  readonly adjustedUnitPriceMinor: number;
  readonly adjustedUnitPriceCnyMinor: number;
  readonly lineTotalMinor: number;
  readonly lineTotalCnyMinor: number;
  readonly weightContributionGrams: number;
  readonly blonde: boolean;
  readonly sku?: string;
  readonly line?: string;
  readonly productType?: string;
  readonly lengthIn?: string | null;
  readonly unit?: string;
  readonly packWeightGrams?: number | null;
}

export interface PricingAdjustment {
  readonly code: string;
  readonly label: string;
  readonly type: PricingAdjustmentType;
  readonly scope: PricingAdjustmentScope;
  readonly itemRef?: string;
  readonly amountMinor: number;
  readonly amountCnyMinor?: number;
  readonly ruleVersion: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PricingResult {
  readonly currency: string;
  readonly lines: readonly PricingLine[];
  readonly subtotalMinor: number;
  readonly subtotalCnyMinor: number;
  readonly adjustments: readonly PricingAdjustment[];
  readonly totalMinor: number;
  readonly totalCnyMinor: number;
  readonly surchargeMinor: number;
  readonly surchargeCnyMinor: number;
  readonly discountMinor: number;
  readonly discountCnyMinor: number;
  readonly totalWeightGrams: number;
  readonly selectedDiscountReason: 'EXPO_DISCOUNT' | 'VOLUME_DISCOUNT' | null;
  readonly ruleVersion: string;
}

export interface PricingContext {
  readonly input: PricingInput;
  readonly lines: readonly PricingLine[];
  readonly subtotalMinor: number;
  readonly subtotalCnyMinor: number;
  readonly phase: PricingRuleScope;
  readonly totalWeightGrams: number;
  readonly orderDiscountCode?: 'EXPO_DISCOUNT' | 'VOLUME_DISCOUNT';
}

export interface PricingRule {
  readonly code: string;
  readonly version: string;
  readonly scope: PricingRuleScope;
  readonly priority?: number;
  apply(context: PricingContext): PricingAdjustment[];
}
