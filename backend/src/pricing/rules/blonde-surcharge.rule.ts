import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';
import { percentageAmountMinor } from '../pricing-math';

export interface BlondeSurchargeConfig { readonly enabled?: boolean; readonly version?: string; }

export class BlondeSurchargeRule implements PricingRule {
  readonly code = 'BLONDE_SURCHARGE';
  readonly version: string;
  readonly scope = 'ITEM' as const;
  readonly priority = 10;
  private readonly enabled: boolean;

  constructor(config: BlondeSurchargeConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return context.input.items.filter((item) => item.blonde === true).map((item) => ({
      code: this.code,
      label: 'Blonde shade surcharge (30%)',
      type: 'SURCHARGE' as const,
      scope: 'ITEM' as const,
      itemRef: item.itemRef,
      amountMinor: percentageAmountMinor(item.baseUnitPriceMinor, 3000, 'HALF_UP') * item.quantity,
      amountCnyMinor: percentageAmountMinor(item.baseUnitPriceCnyMinor ?? item.baseUnitPriceMinor, 3000, 'HALF_UP') * item.quantity,
      ruleVersion: this.version,
      metadata: { basisPoints: 3000 },
    }));
  }
}
