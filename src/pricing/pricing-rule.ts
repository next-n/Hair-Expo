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
  readonly productTags?: readonly string[];
  readonly productType?: string;
}

export interface PricingInput {
  readonly currency: string;
  readonly items: readonly PricingItemInput[];
}

export interface PricingLine {
  readonly itemRef: string;
  readonly productId: string;
  readonly variantId?: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineTotalMinor: number;
}

export interface PricingAdjustment {
  readonly code: string;
  readonly label: string;
  readonly type: PricingAdjustmentType;
  readonly scope: PricingAdjustmentScope;
  readonly itemRef?: string;
  readonly amountMinor: number;
  readonly ruleVersion: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PricingResult {
  readonly currency: string;
  readonly lines: readonly PricingLine[];
  readonly subtotalMinor: number;
  readonly adjustments: readonly PricingAdjustment[];
  readonly totalMinor: number;
  readonly ruleVersion: string;
}

export interface PricingContext {
  readonly input: PricingInput;
  readonly lines: readonly PricingLine[];
  readonly subtotalMinor: number;
  readonly phase: PricingRuleScope;
}

export interface PricingRule {
  readonly code: string;
  readonly version: string;
  readonly scope: PricingRuleScope;
  apply(context: PricingContext): PricingAdjustment[];
}
