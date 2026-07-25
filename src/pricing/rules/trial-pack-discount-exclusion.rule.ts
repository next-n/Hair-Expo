import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';

export interface TrialPackDiscountExclusionConfig { readonly enabled?: boolean; readonly version?: string; }

export class TrialPackDiscountExclusionRule implements PricingRule {
  readonly code = 'TRIAL_PACK_DISCOUNT_EXCLUSION';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  private readonly enabled: boolean;

  constructor(config: TrialPackDiscountExclusionConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(_context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return []; // Business rule intentionally deferred.
  }
}
