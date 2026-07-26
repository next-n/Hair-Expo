import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { BlondeSurchargeRule } from '../src/pricing/rules/blonde-surcharge.rule';
import { ExpoDiscountRule } from '../src/pricing/rules/expo-discount.rule';
import { VolumeDiscountRule } from '../src/pricing/rules/volume-discount.rule';

const engine = () => new DefaultPricingEngine([
  new BlondeSurchargeRule({ enabled: true, version: 'test-blonde-v1' }),
  new ExpoDiscountRule({ enabled: true, version: 'test-expo-v1' }),
  new VolumeDiscountRule({ enabled: true, version: 'test-volume-v1' }),
]);

const item = (overrides: Record<string, unknown> = {}) => ({
  itemRef: 'item-1', productId: 'product-1', quantity: 1, baseUnitPriceMinor: 10000, baseUnitPriceCnyMinor: 70000, packWeightGrams: 70, unit: 'pack_100pcs', ...overrides,
});

describe('TRUNOV assignment pricing rules', () => {
  it('matches the exact interview order in USD and CNY', () => {
    const result = engine().calculate({ currency: 'USD', expoDiscountEnabled: true, items: [
      item({ itemRef: 'normal', sku: 'SD-KT-22' }),
      item({ itemRef: 'blonde', sku: 'SD-KT-22', blonde: true }),
      item({ itemRef: 'raw', sku: 'RAW-MM-24', quantity: 3, baseUnitPriceMinor: 85000, baseUnitPriceCnyMinor: 595000, packWeightGrams: 1000, unit: 'per_kg' }),
    ] });
    expect(result.subtotalMinor).toBe(278000);
    expect(result.totalWeightGrams).toBe(3140);
    expect(result.selectedDiscountReason).toBe('EXPO_DISCOUNT');
    expect(result.discountMinor).toBe(27800);
    expect(result.totalMinor).toBe(250200);
    expect(result.subtotalCnyMinor).toBe(1946000);
    expect(result.discountCnyMinor).toBe(194600);
    expect(result.totalCnyMinor).toBe(1751400);
  });

  it('allows separate normal and blonde lines for the same SKU', () => {
    const result = engine().calculate({ currency: 'USD', items: [item({ itemRef: 'normal' }), item({ itemRef: 'blonde', blonde: true })] });
    expect(result.adjustments.filter((adjustment) => adjustment.code === 'BLONDE_SURCHARGE')).toHaveLength(1);
    expect(result.lines.map((line) => line.lineTotalMinor)).toEqual([10000, 13000]);
  });

  it('selects volume at exactly 10 kg and never stacks discounts', () => {
    const result = engine().calculate({ currency: 'USD', expoDiscountEnabled: true, items: [item({ quantity: 10, packWeightGrams: 1000 })] });
    expect(result.totalWeightGrams).toBe(10000);
    expect(result.selectedDiscountReason).toBe('VOLUME_DISCOUNT');
    expect(result.adjustments.filter((adjustment) => adjustment.type === 'DISCOUNT')).toHaveLength(1);
    expect(result.adjustments[0].code).toBe('VOLUME_DISCOUNT');
  });

  it('uses Expo only below the threshold and respects the toggle', () => {
    const expo = engine().calculate({ currency: 'USD', expoDiscountEnabled: true, items: [item()] });
    const off = engine().calculate({ currency: 'USD', expoDiscountEnabled: false, items: [item()] });
    expect(expo.selectedDiscountReason).toBe('EXPO_DISCOUNT');
    expect(off.selectedDiscountReason).toBeNull();
    expect(off.totalMinor).toBe(10000);
  });

  it('treats missing Trial Pack weight as zero and keeps it discount eligible', () => {
    const result = engine().calculate({ currency: 'USD', items: [item({ sku: 'PROMO-TRIAL', baseUnitPriceMinor: 14900, baseUnitPriceCnyMinor: 99900, packWeightGrams: undefined, unit: 'pack' })] });
    expect(result.totalWeightGrams).toBe(0);
    expect(result.selectedDiscountReason).toBe('EXPO_DISCOUNT');
  });

  it('rejects zero or negative quantity and does not mutate input', () => {
    expect(() => engine().calculate({ currency: 'USD', items: [item({ quantity: 0 })] })).toThrow();
    expect(() => engine().calculate({ currency: 'USD', items: [item({ quantity: -1 })] })).toThrow();
    const input = { currency: 'USD', items: [item({ blonde: true })] };
    const copy = JSON.parse(JSON.stringify(input));
    expect(engine().calculate(input)).toEqual(engine().calculate(input));
    expect(input).toEqual(copy);
  });
});
