import { Inject, Injectable } from '@nestjs/common';
import { BASE_PRICE_SOURCE, BasePriceSource } from './pricing-source';
import { NormalizedOrderDraft, PriceSnapshot } from './pricing-input';
import { PRICING_ENGINE, PricingEngine } from './pricing-engine';

function freeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T;
  if (value !== null && typeof value === 'object') {
    Object.values(value as object).forEach(freeze);
    return Object.freeze(value);
  }
  return value;
}

@Injectable()
export class PricingService {
  constructor(
    @Inject(PRICING_ENGINE) private readonly engine: PricingEngine,
    @Inject(BASE_PRICE_SOURCE) private readonly priceSource: BasePriceSource,
  ) {}

  calculate(draft: NormalizedOrderDraft): PriceSnapshot {
    const input = {
      currency: draft.currency.toUpperCase(),
      items: draft.items.map((item) => ({
        ...item,
        baseUnitPriceMinor: item.baseUnitPriceMinor ?? this.priceSource.getBaseUnitPriceMinor(item),
      })),
    };
    return freeze(this.engine.calculate(input));
  }
}
