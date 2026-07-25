import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';

export interface ExpoDiscountConfig { readonly enabled?: boolean; readonly version?: string; }

export class ExpoDiscountRule implements PricingRule {
  readonly code = 'EXPO_DISCOUNT';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  private readonly enabled: boolean;

  constructor(config: ExpoDiscountConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(_context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return []; // Business rule intentionally deferred.
  }
}
