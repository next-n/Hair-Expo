import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';
import { percentageAmountMinor } from '../pricing-math';

export interface VolumeDiscountConfig { readonly enabled?: boolean; readonly version?: string; }

export class VolumeDiscountRule implements PricingRule {
  readonly code = 'VOLUME_DISCOUNT';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  readonly priority = 10;
  private readonly enabled: boolean;

  constructor(config: VolumeDiscountConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    if (context.orderDiscountCode !== this.code || context.totalWeightGrams < 10_000) return [];
    return [{
      code: this.code,
      label: 'Volume discount (10%)',
      type: 'DISCOUNT',
      scope: 'ORDER',
      amountMinor: percentageAmountMinor(context.subtotalMinor, 1000, 'HALF_UP'),
      amountCnyMinor: percentageAmountMinor(context.subtotalCnyMinor, 1000, 'HALF_UP'),
      ruleVersion: this.version,
      metadata: { basisPoints: 1000, reason: this.code, thresholdGrams: 10_000 },
    }];
  }
}
