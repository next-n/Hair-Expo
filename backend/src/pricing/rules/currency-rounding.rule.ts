import { PricingAdjustment, PricingContext, PricingRule } from '../pricing-rule';
import { RoundingMode } from '../pricing-math';

export interface CurrencyRoundingConfig { readonly enabled?: boolean; readonly mode?: RoundingMode; readonly version?: string; }

export class CurrencyRoundingRule implements PricingRule {
  readonly code = 'CURRENCY_ROUNDING';
  readonly version: string;
  readonly scope = 'ORDER' as const;
  readonly mode: RoundingMode;
  private readonly enabled: boolean;

  constructor(config: CurrencyRoundingConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.mode = config.mode ?? 'HALF_UP';
    this.version = config.version ?? 'placeholder-v1';
  }

  apply(_context: PricingContext): PricingAdjustment[] {
    if (!this.enabled) return [];
    return []; // Values are already minor-unit integers; final currency policy is deferred.
  }
}
