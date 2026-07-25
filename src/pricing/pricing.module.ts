import { Module } from '@nestjs/common';
import { DefaultPricingEngine } from './default-pricing-engine';
import { PRICING_ENGINE, PRICING_RULES } from './pricing-engine';
import { MockPriceSource } from './mock-price-source';
import { BASE_PRICE_SOURCE } from './pricing-source';
import { PricingRule } from './pricing-rule';
import { PricingService } from './pricing.service';
import { BlondeSurchargeRule } from './rules/blonde-surcharge.rule';
import { CurrencyRoundingRule } from './rules/currency-rounding.rule';
import { ExpoDiscountRule } from './rules/expo-discount.rule';
import { TrialPackDiscountExclusionRule } from './rules/trial-pack-discount-exclusion.rule';
import { VolumeDiscountRule } from './rules/volume-discount.rule';

@Module({
  providers: [
    BlondeSurchargeRule, ExpoDiscountRule, VolumeDiscountRule,
    TrialPackDiscountExclusionRule, CurrencyRoundingRule, MockPriceSource,
    { provide: BASE_PRICE_SOURCE, useExisting: MockPriceSource },
    {
      provide: PRICING_RULES,
      useFactory: (blonde: BlondeSurchargeRule, expo: ExpoDiscountRule, volume: VolumeDiscountRule, trial: TrialPackDiscountExclusionRule, rounding: CurrencyRoundingRule) => [blonde, expo, volume, trial, rounding],
      inject: [BlondeSurchargeRule, ExpoDiscountRule, VolumeDiscountRule, TrialPackDiscountExclusionRule, CurrencyRoundingRule],
    },
    { provide: PRICING_ENGINE, useFactory: (rules: readonly PricingRule[]) => new DefaultPricingEngine(rules), inject: [PRICING_RULES] },
    PricingService,
  ],
  exports: [PricingService, PRICING_ENGINE, BASE_PRICE_SOURCE],
})
export class PricingModule {}
