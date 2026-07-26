import { Injectable } from '@nestjs/common';
import { PricingEngine } from './pricing-engine';
import { PricingAdjustment, PricingAdjustmentScope, PricingContext, PricingInput, PricingLine, PricingResult, PricingRule, PricingRuleScope } from './pricing-rule';
import { addMinor, assertNonNegativeInteger, multiplyMinor } from './pricing-math';

const RULE_VERSION = 'trunov-pricing-v1';

function immutableClone<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutableClone)) as T;
  if (value !== null && typeof value === 'object') {
    const cloned = Object.fromEntries(Object.entries(value as object).map(([key, nested]) => [key, immutableClone(nested)]));
    return Object.freeze(cloned) as T;
  }
  return value;
}

function weightForItem(item: PricingInput['items'][number]): number {
  if (item.unit === 'per_kg') return 1000;
  return item.packWeightGrams ?? item.weightGrams ?? 0;
}

@Injectable()
export class DefaultPricingEngine implements PricingEngine {
  constructor(private readonly rules: readonly PricingRule[] = []) {}

  calculate(input: PricingInput): PricingResult {
    const safeInput = immutableClone(input);
    const lines = safeInput.items.map((item): PricingLine => {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error(`quantity for ${item.itemRef} must be a positive integer`);
      assertNonNegativeInteger(item.baseUnitPriceMinor, `baseUnitPriceMinor for ${item.itemRef}`);
      const baseCny = item.baseUnitPriceCnyMinor ?? item.baseUnitPriceMinor;
      assertNonNegativeInteger(baseCny, `baseUnitPriceCnyMinor for ${item.itemRef}`);
      if (item.weightGrams !== undefined && (item.weightGrams < 0 || !Number.isFinite(item.weightGrams))) throw new Error(`weightGrams for ${item.itemRef} must be non-negative`);
      if (item.lengthInches !== undefined && (item.lengthInches < 0 || !Number.isFinite(item.lengthInches))) throw new Error(`lengthInches for ${item.itemRef} must be non-negative`);
      const lineWeight = multiplyMinor(weightForItem(item), item.quantity, `weight for ${item.itemRef}`);
      return {
        itemRef: item.itemRef,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceMinor: item.baseUnitPriceMinor,
        unitPriceCnyMinor: baseCny,
        baseUnitPriceMinor: item.baseUnitPriceMinor,
        baseUnitPriceCnyMinor: baseCny,
        adjustedUnitPriceMinor: item.baseUnitPriceMinor,
        adjustedUnitPriceCnyMinor: baseCny,
        lineTotalMinor: multiplyMinor(item.baseUnitPriceMinor, item.quantity, `lineTotalMinor for ${item.itemRef}`),
        lineTotalCnyMinor: multiplyMinor(baseCny, item.quantity, `lineTotalCnyMinor for ${item.itemRef}`),
        weightContributionGrams: lineWeight,
        blonde: item.blonde === true,
        sku: item.sku,
        line: item.line,
        productType: item.productType,
        lengthIn: item.lengthInches?.toString() ?? null,
        unit: item.unit,
        packWeightGrams: item.packWeightGrams ?? item.weightGrams ?? null,
      };
    });
    const baseSubtotalMinor = this.sum(lines.map((line) => line.lineTotalMinor));
    const baseSubtotalCnyMinor = this.sum(lines.map((line) => line.lineTotalCnyMinor));
    const totalWeightGrams = lines.reduce((sum, line) => addMinor(sum, line.weightContributionGrams, 'total weight'), 0);
    const selectedDiscountReason = totalWeightGrams >= 10_000 ? 'VOLUME_DISCOUNT' : safeInput.expoDiscountEnabled !== false ? 'EXPO_DISCOUNT' : null;
    const adjustments: PricingAdjustment[] = [];
    const applied = new Set<string>();
    const orderedRules = this.rules.slice().sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100) || left.code.localeCompare(right.code) || left.version.localeCompare(right.version));

    // 1. Calculate base line totals.
    // 2. Apply item-level surcharges.
    for (const rule of orderedRules) {
      if (rule.scope === 'ORDER') continue;
      this.applyRule(rule, 'ITEM', safeInput, lines, baseSubtotalMinor, baseSubtotalCnyMinor, totalWeightGrams, undefined, adjustments, applied);
    }
    // 3. Calculate subtotal after item-level surcharges.
    const subtotalMinor = this.totalAfter(adjustments, baseSubtotalMinor, 'ITEM', false);
    const subtotalCnyMinor = this.totalAfter(adjustments, baseSubtotalCnyMinor, 'ITEM', true);
    // 4. Apply exactly one selected order-level discount.
    for (const rule of orderedRules) {
      if (rule.scope === 'ITEM') continue;
      this.applyRule(rule, 'ORDER', safeInput, lines, subtotalMinor, subtotalCnyMinor, totalWeightGrams, selectedDiscountReason ?? undefined, adjustments, applied);
    }
    // 5. Values are already integer cents/fen. Currency rounding is explicit in percentageAmountMinor.
    // 6. Produce non-negative totals and a complete immutable snapshot.
    const totalMinor = Math.max(0, this.totalAfter(adjustments, subtotalMinor, 'ORDER', false));
    const totalCnyMinor = Math.max(0, this.totalAfter(adjustments, subtotalCnyMinor, 'ORDER', true));
    const surchargeMinor = adjustments.filter((item) => item.type === 'SURCHARGE').reduce((sum, item) => addMinor(sum, item.amountMinor, 'surcharge'), 0);
    const surchargeCnyMinor = adjustments.filter((item) => item.type === 'SURCHARGE').reduce((sum, item) => addMinor(sum, item.amountCnyMinor ?? item.amountMinor, 'CNY surcharge'), 0);
    const discountMinor = adjustments.filter((item) => item.type === 'DISCOUNT').reduce((sum, item) => addMinor(sum, item.amountMinor, 'discount'), 0);
    const discountCnyMinor = adjustments.filter((item) => item.type === 'DISCOUNT').reduce((sum, item) => addMinor(sum, item.amountCnyMinor ?? item.amountMinor, 'CNY discount'), 0);
    const adjustedLines = lines.map((line) => {
      const itemAdjustments = adjustments.filter((item) => item.scope === 'ITEM' && item.itemRef === line.itemRef);
      const adjustedTotal = this.totalAfter(itemAdjustments, line.lineTotalMinor, 'ITEM', false);
      const adjustedTotalCny = this.totalAfter(itemAdjustments, line.lineTotalCnyMinor, 'ITEM', true);
      return { ...line, adjustedUnitPriceMinor: Math.floor(adjustedTotal / line.quantity), adjustedUnitPriceCnyMinor: Math.floor(adjustedTotalCny / line.quantity), unitPriceMinor: Math.floor(adjustedTotal / line.quantity), unitPriceCnyMinor: Math.floor(adjustedTotalCny / line.quantity), lineTotalMinor: adjustedTotal, lineTotalCnyMinor: adjustedTotalCny };
    });
    return immutableClone({ currency: safeInput.currency, lines: adjustedLines, subtotalMinor, subtotalCnyMinor, adjustments, totalMinor, totalCnyMinor, surchargeMinor, surchargeCnyMinor, discountMinor, discountCnyMinor, totalWeightGrams, selectedDiscountReason, ruleVersion: RULE_VERSION });
  }

  private applyRule(rule: PricingRule, phase: PricingRuleScope, input: PricingInput, lines: readonly PricingLine[], subtotalMinor: number, subtotalCnyMinor: number, totalWeightGrams: number, orderDiscountCode: 'EXPO_DISCOUNT' | 'VOLUME_DISCOUNT' | undefined, adjustments: PricingAdjustment[], applied: Set<string>): void {
    const key = `${rule.code}:${phase}`;
    if (applied.has(key)) return;
    applied.add(key);
    const context: PricingContext = immutableClone({ input, lines, subtotalMinor, subtotalCnyMinor, phase, totalWeightGrams, orderDiscountCode });
    const produced = rule.apply(context);
    for (const adjustment of produced) {
      if (adjustment.scope !== phase) throw new Error(`Rule ${rule.code} returned an invalid scope for ${phase}`);
      if (adjustment.amountMinor < 0 || !Number.isSafeInteger(adjustment.amountMinor)) throw new Error(`Rule ${rule.code} returned an invalid amount`);
      if (adjustment.amountCnyMinor !== undefined && (adjustment.amountCnyMinor < 0 || !Number.isSafeInteger(adjustment.amountCnyMinor))) throw new Error(`Rule ${rule.code} returned an invalid CNY amount`);
      if (adjustment.scope === 'ITEM' && !lines.some((line) => line.itemRef === adjustment.itemRef)) throw new Error(`Rule ${rule.code} referenced an unknown item`);
      adjustments.push(immutableClone({ ...adjustment, amountCnyMinor: adjustment.amountCnyMinor ?? adjustment.amountMinor, ruleVersion: rule.version }));
    }
  }

  private totalAfter(adjustments: readonly PricingAdjustment[], startingMinor: number, scope: PricingAdjustmentScope, cny: boolean): number {
    let total = startingMinor;
    for (const adjustment of adjustments) {
      if (adjustment.scope !== scope) continue;
      const amount = cny ? adjustment.amountCnyMinor ?? adjustment.amountMinor : adjustment.amountMinor;
      total = addMinor(total, adjustment.type === 'SURCHARGE' ? amount : -amount, `${scope} total`);
    }
    return total;
  }

  private sum(values: readonly number[]): number {
    const total = values.reduce((sum, value) => addMinor(sum, value, 'subtotal'), 0);
    assertNonNegativeInteger(total, 'totalMinor');
    return total;
  }
}
