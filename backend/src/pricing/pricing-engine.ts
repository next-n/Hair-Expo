import { PricingInput, PricingResult, PricingRule } from './pricing-rule';

export interface PricingEngine {
  calculate(input: PricingInput): PricingResult;
}

export const PRICING_ENGINE = Symbol('PRICING_ENGINE');
export const PRICING_RULES = Symbol('PRICING_RULES');

export function stableRuleOrder(rules: readonly PricingRule[]): PricingRule[] {
  return [...rules].sort((left, right) => left.code.localeCompare(right.code) || left.version.localeCompare(right.version));
}
