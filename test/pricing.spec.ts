import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { percentageAmountMinor } from '../src/pricing/pricing-math';
import { PricingAdjustment, PricingContext, PricingRule } from '../src/pricing/pricing-rule';

function item(overrides: Partial<{ itemRef: string; quantity: number; baseUnitPriceMinor: number; weightGrams: number }> = {}) {
  return {
    itemRef: 'item-1',
    productId: 'product-1',
    quantity: 1,
    baseUnitPriceMinor: 100,
    ...overrides,
  };
}

class WeightSurchargeExample implements PricingRule {
  readonly code = 'EXAMPLE_WEIGHT_SURCHARGE';
  readonly version = 'example-v1';
  readonly scope = 'ITEM' as const;

  apply(context: PricingContext): PricingAdjustment[] {
    return context.input.items.filter((value) => (value.weightGrams ?? 0) > 500).map((value) => ({
      code: this.code,
      label: 'Example weight surcharge',
      type: 'SURCHARGE' as const,
      scope: 'ITEM' as const,
      itemRef: value.itemRef,
      amountMinor: 25,
      ruleVersion: this.version,
    }));
  }
}

class PercentageDiscountExample implements PricingRule {
  readonly code = 'EXAMPLE_ORDER_DISCOUNT';
  readonly version = 'example-v1';
  readonly scope = 'ORDER' as const;

  apply(context: PricingContext): PricingAdjustment[] {
    return [{
      code: this.code,
      label: 'Example order discount',
      type: 'DISCOUNT',
      scope: 'ORDER',
      amountMinor: percentageAmountMinor(context.subtotalMinor, 1000, 'HALF_UP'),
      ruleVersion: this.version,
    }];
  }
}

class ExcessiveDiscountExample implements PricingRule {
  readonly code = 'EXAMPLE_EXCESSIVE_DISCOUNT';
  readonly version = 'example-v1';
  readonly scope = 'ORDER' as const;

  apply(): PricingAdjustment[] {
    return [{ code: this.code, label: 'Example excessive discount', type: 'DISCOUNT', scope: 'ORDER', amountMinor: 999, ruleVersion: this.version }];
  }
}

describe('DefaultPricingEngine', () => {
  it('prices an empty order at zero', () => {
    expect(new DefaultPricingEngine().calculate({ currency: 'USD', items: [] })).toMatchObject({ subtotalMinor: 0, totalMinor: 0, adjustments: [] });
  });

  it('calculates one item, multiple items, and quantity multiplication', () => {
    const engine = new DefaultPricingEngine();
    expect(engine.calculate({ currency: 'USD', items: [item({ quantity: 3 })] }).totalMinor).toBe(300);
    expect(engine.calculate({ currency: 'USD', items: [item(), item({ itemRef: 'item-2', baseUnitPriceMinor: 250, quantity: 2 })] }).totalMinor).toBe(600);
  });

  it('supports weight-based example calculations without embedding them in the engine', () => {
    const result = new DefaultPricingEngine([new WeightSurchargeExample()]).calculate({ currency: 'USD', items: [item({ weightGrams: 501 })] });
    expect(result.adjustments).toHaveLength(1);
    expect(result.totalMinor).toBe(125);
  });

  it('applies item surcharges before order discounts', () => {
    const result = new DefaultPricingEngine([new PercentageDiscountExample(), new WeightSurchargeExample()]).calculate({
      currency: 'USD', items: [item({ baseUnitPriceMinor: 1000, weightGrams: 501 })],
    });
    expect(result.subtotalMinor).toBe(1025);
    expect(result.adjustments.map((adjustment) => adjustment.code)).toEqual(['EXAMPLE_WEIGHT_SURCHARGE', 'EXAMPLE_ORDER_DISCOUNT']);
    expect(result.totalMinor).toBe(922);
  });

  it('uses deterministic rule ordering and ignores duplicate rules per scope', () => {
    const rule = new WeightSurchargeExample();
    const result = new DefaultPricingEngine([rule, new PercentageDiscountExample(), rule]).calculate({ currency: 'USD', items: [item({ weightGrams: 501 })] });
    expect(result.adjustments.map((adjustment) => adjustment.code)).toEqual(['EXAMPLE_WEIGHT_SURCHARGE', 'EXAMPLE_ORDER_DISCOUNT']);
  });

  it('never allows a negative total and rejects negative values', () => {
    expect(new DefaultPricingEngine([new ExcessiveDiscountExample()]).calculate({ currency: 'USD', items: [item()] }).totalMinor).toBe(0);
    expect(() => new DefaultPricingEngine().calculate({ currency: 'USD', items: [item({ quantity: -1 })] })).toThrow();
    expect(() => new DefaultPricingEngine().calculate({ currency: 'USD', items: [item({ baseUnitPriceMinor: -1 })] })).toThrow();
    expect(() => new DefaultPricingEngine().calculate({ currency: 'USD', items: [item({ weightGrams: -1 })] })).toThrow();
  });

  it('uses explicit integer percentage rounding', () => {
    expect(percentageAmountMinor(101, 5000, 'FLOOR')).toBe(50);
    expect(percentageAmountMinor(101, 5000, 'CEIL')).toBe(51);
    expect(percentageAmountMinor(101, 5000, 'HALF_UP')).toBe(51);
  });

  it('does not mutate input and is deterministic', () => {
    const input = { currency: 'USD', items: [item({ weightGrams: 501 })] };
    const before = JSON.parse(JSON.stringify(input));
    const engine = new DefaultPricingEngine([new WeightSurchargeExample()]);
    const first = engine.calculate(input);
    const second = engine.calculate(input);
    expect(input).toEqual(before);
    expect(second).toEqual(first);
  });
});
