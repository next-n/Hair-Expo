export interface PricingRuleContext {
  readonly currency: string;
  readonly items: ReadonlyArray<{ productId: string; quantity: number }>;
}

export interface PricingRuleResult {
  readonly totalAmountMinor: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PricingRule {
  calculate(context: PricingRuleContext): PricingRuleResult;
}

export const PRICING_RULE = Symbol('PRICING_RULE');
