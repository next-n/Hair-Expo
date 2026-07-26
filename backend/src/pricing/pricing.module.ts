import { Module } from '@nestjs/common';
import { DefaultPricingEngine } from './default-pricing-engine';
import { PRICING_ENGINE, PRICING_RULES } from './pricing-engine';
import { MockPriceSource } from './mock-price-source';
import { BASE_PRICE_SOURCE } from './pricing-source';
import { PricingRule } from './pricing-rule';
import { PricingService } from './pricing.service';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogPriceSource } from './catalog-price-source';
import { BlondeSurchargeRule } from './rules/blonde-surcharge.rule';
import { CurrencyRoundingRule } from './rules/currency-rounding.rule';
import { ExpoDiscountRule } from './rules/expo-discount.rule';
import { TrialPackDiscountExclusionRule } from './rules/trial-pack-discount-exclusion.rule';
import { VolumeDiscountRule } from './rules/volume-discount.rule';

@Module({
  imports: [CatalogModule],
  providers: [
    BlondeSurchargeRule, ExpoDiscountRule, VolumeDiscountRule,
    TrialPackDiscountExclusionRule, CurrencyRoundingRule, MockPriceSource, CatalogPriceSource,
    { provide: BASE_PRICE_SOURCE, useExisting: CatalogPriceSource },
    {
      provide: PRICING_RULES,
      useFactory: () => [new BlondeSurchargeRule({ enabled: true, version: 'trunov-blonde-v1' }), new ExpoDiscountRule({ enabled: true, version: 'trunov-expo-v1' }), new VolumeDiscountRule({ enabled: true, version: 'trunov-volume-v1' }), new TrialPackDiscountExclusionRule({ enabled: true, version: 'trunov-trial-v1' }), new CurrencyRoundingRule({ enabled: true, version: 'trunov-rounding-v1' })],
      inject: [],
    },
    { provide: PRICING_ENGINE, useFactory: (rules: readonly PricingRule[]) => new DefaultPricingEngine(rules), inject: [PRICING_RULES] },
    PricingService,
  ],
  exports: [PricingService, PRICING_ENGINE, BASE_PRICE_SOURCE],
})
export class PricingModule {}
