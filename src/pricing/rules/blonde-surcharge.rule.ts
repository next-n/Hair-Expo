import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';

export interface BlondeSurchargeConfig { readonly enabled?: boolean; readonly version?: string; }

export class BlondeSurchargeRule implements PricingRule {
  readonly code = 'BLONDE_SURCHARGE';
  readonly version: string;
  readonly scope = 'ITEM' as const;
  private readonly enabled: boolean;

  constructor(config: BlondeSurchargeConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(_context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return []; // Business rule intentionally deferred.
  }
}
