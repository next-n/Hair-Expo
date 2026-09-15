import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { percentageAmountMinor } from '../src/pricing/pricing-math';
import { PricingAdjustment, PricingContext, PricingRule } from '../src/pricing/pricing-rule';
import { BlondeSurchargeRule } from '../src/pricing/rules/blonde-surcharge.rule';

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
    expect(() => new DefaultPricingEngine().calculate({ currency: 'USD', items: [item({ baseUnitPriceMinor: Number.MAX_SAFE_INTEGER, quantity: 2 })] })).toThrow(/safe integer range/);
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

describe('DefaultPricingEngine weighted items', () => {
  const gramItem = (overrides: Record<string, unknown> = {}) => ({
    itemRef: 'item-1',
    productId: 'product-1',
    quantity: 1,
    baseUnitPriceMinor: 8500,   // $85.00 for 100g
    baseUnitPriceCnyMinor: 59500,
    unit: 'per_100g',
    packWeightGrams: 100,
    sku: 'MG-GW-18',
    line: 'Magnetar',
    productType: 'Genius Weft',
    ...overrides,
  });

  const kgItem = (overrides: Record<string, unknown> = {}) => ({
    itemRef: 'item-2',
    productId: 'product-2',
    quantity: 1,
    baseUnitPriceMinor: 120000, // $1200.00 per kg
    baseUnitPriceCnyMinor: 840000,
    unit: 'per_kg',
    packWeightGrams: 1000,
    sku: 'RAW-SLV-1820',
    line: 'Raw Hair',
    productType: 'Slavic',
    ...overrides,
  });

  it('prices per_100g items by the exact requested weight', () => {
    const result = new DefaultPricingEngine().calculate({
      currency: 'USD',
      items: [gramItem({ weightGrams: 50 })],
    });
    expect(result.lines[0].lineTotalMinor).toBe(4250);      // 85c/g × 50g
    expect(result.lines[0].weightContributionGrams).toBe(50);
    expect(result.lines[0].adjustedUnitPriceMinor).toBe(85); // $0.85/g
    expect(result.totalMinor).toBe(4250);
  });

  it('prices per_100g items at 250g', () => {
    const result = new DefaultPricingEngine().calculate({
      currency: 'USD',
      items: [gramItem({ weightGrams: 250 })],
    });
    expect(result.lines[0].lineTotalMinor).toBe(21250); // $212.50
  });

  it('prices per_kg items by the exact requested weight', () => {
    const result = new DefaultPricingEngine().calculate({
      currency: 'USD',
      items: [kgItem({ weightGrams: 500 })],
    });
    expect(result.lines[0].lineTotalMinor).toBe(60000);      // 120c/g × 500g = $600
    expect(result.lines[0].adjustedUnitPriceMinor).toBe(120);
    expect(result.totalMinor).toBe(60000);
  });

  it('falls back to packWeightGrams × quantity when weightGrams is omitted', () => {
    const result = new DefaultPricingEngine().calculate({
      currency: 'USD',
      items: [gramItem({ quantity: 3 })],
    });
    expect(result.lines[0].weightContributionGrams).toBe(300);
    expect(result.lines[0].lineTotalMinor).toBe(25500); // 85c × 300g
  });

  it('applies blonde surcharge to the weighted line total', () => {
    const result = new DefaultPricingEngine([
      new BlondeSurchargeRule({ enabled: true, version: 'test-blonde-v1' }),
    ]).calculate({
      currency: 'USD',
      items: [gramItem({ weightGrams: 50, blonde: true })],
    });
    expect(result.subtotalMinor).toBe(5525);       // base 50g
    expect(result.surchargeMinor).toBe(1275);      // 30% of 4250
    expect(result.totalMinor).toBe(5525);
    expect(result.lines[0].lineTotalMinor).toBe(5525);
  });

  it('combines a weighted item and a pack item in the same order', () => {
    const result = new DefaultPricingEngine().calculate({
      currency: 'USD',
      items: [
        gramItem({ itemRef: 'gram', weightGrams: 100 }),
        {
          itemRef: 'pack', productId: 'p2', quantity: 2, baseUnitPriceMinor: 5500,
          unit: 'pack_100pcs', packWeightGrams: 67, sku: 'MG-KT-18',
          line: 'Magnetar', productType: 'Keratin Tips',
        },
      ],
    });
    expect(result.totalMinor).toBe(19500);         // 8500 + 11000
    expect(result.totalWeightGrams).toBe(234);     // 100 + 2×67
  });
});
