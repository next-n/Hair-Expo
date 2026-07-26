import { Inject, Injectable } from '@nestjs/common';
import { BASE_PRICE_SOURCE, BasePriceSource } from './pricing-source';
import { NormalizedOrderDraft, PriceSnapshot } from './pricing-input';
import { PRICING_ENGINE, PricingEngine } from './pricing-engine';
import { CHECKOUT_LIMITS } from '../checkout-intake/request-limits';

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
    if (draft.items.length < 1 || draft.items.length > CHECKOUT_LIMITS.maxItems) throw new Error('Order must contain between 1 and 100 items');
    for (const item of draft.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > CHECKOUT_LIMITS.maxQuantity) throw new Error('Quantity is outside the allowed range');
      if (item.weightGrams !== undefined && (item.weightGrams < 0 || item.weightGrams > CHECKOUT_LIMITS.maxWeightGrams)) throw new Error('Weight is outside the allowed range');
      if (item.lengthInches !== undefined && (item.lengthInches < 0 || item.lengthInches > CHECKOUT_LIMITS.maxLengthInches)) throw new Error('Length is outside the allowed range');
      if (item.color !== undefined && item.color.length > CHECKOUT_LIMITS.maxColorLength) throw new Error('Color is too long');
    }
    const input = {
      currency: draft.currency.toUpperCase(),
      expoDiscountEnabled: draft.expoDiscountEnabled,
      items: draft.items.map((item) => {
        const catalog = item.baseUnitPriceMinor === undefined && this.priceSource.getBasePrice ? this.priceSource.getBasePrice(item) : undefined;
        return {
          ...item,
          baseUnitPriceMinor: item.baseUnitPriceMinor ?? catalog?.usdMinor ?? this.priceSource.getBaseUnitPriceMinor(item),
          baseUnitPriceCnyMinor: item.baseUnitPriceCnyMinor ?? catalog?.cnyMinor,
          sku: item.sku ?? catalog?.sku,
          line: item.line ?? catalog?.line,
          productType: item.productType ?? catalog?.productType,
          unit: item.unit ?? catalog?.unit,
          packWeightGrams: item.packWeightGrams ?? catalog?.packWeightGrams ?? undefined,
        };
      }),
    };
    return freeze(this.engine.calculate(input));
  }
}
