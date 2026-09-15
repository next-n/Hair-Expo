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
    
    const adjustments: PricingAdjustment[] = [];
    
    for (const item of context.input.items) {
      if (item.blonde !== true) continue;
      
      // Find the calculated line for this item to get the correct base total
      // (accounting for weight vs quantity)
      const line = context.lines.find((l) => l.itemRef === item.itemRef);
      if (!line) continue; 

      adjustments.push({
        code: this.code,
        label: 'Blonde shade surcharge (30%)',
        type: 'SURCHARGE' as const,
        scope: 'ITEM' as const,
        itemRef: item.itemRef,
        amountMinor: percentageAmountMinor(line.lineTotalMinor, 3000, 'HALF_UP'),
        amountCnyMinor: percentageAmountMinor(line.lineTotalCnyMinor, 3000, 'HALF_UP'),
        ruleVersion: this.version,
        metadata: { basisPoints: 3000 },
      });
    }
    
    return adjustments;
  }
}