import { Module } from '@nestjs/common';
import { MockPricingRule } from './mock-pricing-rule';
import { PRICING_RULE } from './pricing-rule';

@Module({
  providers: [MockPricingRule, { provide: PRICING_RULE, useExisting: MockPricingRule }],
  exports: [MockPricingRule, PRICING_RULE],
})
export class PricingModule {}
