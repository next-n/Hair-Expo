import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';

export interface VolumeDiscountConfig { readonly enabled?: boolean; readonly version?: string; }

export class VolumeDiscountRule implements PricingRule {
  readonly code = 'VOLUME_DISCOUNT';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  private readonly enabled: boolean;

  constructor(config: VolumeDiscountConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(_context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return []; // Business rule intentionally deferred.
  }
}
