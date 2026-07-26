import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';
import { percentageAmountMinor } from '../pricing-math';

export interface ExpoDiscountConfig { readonly enabled?: boolean; readonly version?: string; }

export class ExpoDiscountRule implements PricingRule {
  readonly code = 'EXPO_DISCOUNT';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  readonly priority = 20;
  private readonly enabled: boolean;

  constructor(config: ExpoDiscountConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    if (context.orderDiscountCode !== this.code) return [];
    return [{
      code: this.code,
      label: 'Expo discount (10%)',
      type: 'DISCOUNT',
      scope: 'ORDER',
      amountMinor: percentageAmountMinor(context.subtotalMinor, 1000, 'HALF_UP'),
      amountCnyMinor: percentageAmountMinor(context.subtotalCnyMinor, 1000, 'HALF_UP'),
      ruleVersion: this.version,
      metadata: { basisPoints: 1000, reason: this.code },
    }];
  }
}
