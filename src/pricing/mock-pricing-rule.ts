import { Injectable } from '@nestjs/common';
import { PricingRule, PricingRuleContext, PricingRuleResult } from './pricing-rule';

// Deliberately temporary: real catalog/pricing rules arrive with the assignment brief.
@Injectable()
export class MockPricingRule implements PricingRule {
  calculate(context: PricingRuleContext): PricingRuleResult {
    const totalAmountMinor = context.items.reduce((total, item) => total + (item.quantity * 100), 0);
    return {
      totalAmountMinor,
      metadata: { rule: 'mock-fixed-unit-amount', unitAmountMinor: 100 },
    };
  }
}
