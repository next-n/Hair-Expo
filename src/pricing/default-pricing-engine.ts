import { Injectable } from '@nestjs/common';
import { PricingEngine } from './pricing-engine';
import { PricingAdjustment, PricingAdjustmentScope, PricingContext, PricingInput, PricingLine, PricingResult, PricingRule, PricingRuleScope } from './pricing-rule';
import { assertNonNegativeInteger } from './pricing-math';

const RULE_VERSION = 'pricing-foundation-v1';

function immutableClone<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutableClone)) as T;
  if (value !== null && typeof value === 'object') {
    const cloned = Object.fromEntries(Object.entries(value as object).map(([key, nested]) => [key, immutableClone(nested)]));
    return Object.freeze(cloned) as T;
  }
  return value;
}

@Injectable()
export class DefaultPricingEngine implements PricingEngine {
  constructor(private readonly rules: readonly PricingRule[] = []) {}

  calculate(input: PricingInput): PricingResult {
    const safeInput = immutableClone(input);
    const lines = safeInput.items.map((item): PricingLine => {
      assertNonNegativeInteger(item.quantity, `quantity for ${item.itemRef}`);
      assertNonNegativeInteger(item.baseUnitPriceMinor, `baseUnitPriceMinor for ${item.itemRef}`);
      if (item.weightGrams !== undefined && (item.weightGrams < 0 || !Number.isFinite(item.weightGrams))) throw new Error(`weightGrams for ${item.itemRef} must be non-negative`);
      if (item.lengthInches !== undefined && (item.lengthInches < 0 || !Number.isFinite(item.lengthInches))) throw new Error(`lengthInches for ${item.itemRef} must be non-negative`);
      const lineTotalMinor = item.baseUnitPriceMinor * item.quantity;
      assertNonNegativeInteger(lineTotalMinor, `lineTotalMinor for ${item.itemRef}`);
      return {
        itemRef: item.itemRef,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceMinor: item.baseUnitPriceMinor,
        lineTotalMinor,
      };
    });
    const baseSubtotalMinor = this.sum(lines.map((line) => line.lineTotalMinor));
    const adjustments: PricingAdjustment[] = [];
    const applied = new Set<string>();
    const orderedRules = this.rules.slice().sort((left, right) => left.code.localeCompare(right.code) || left.version.localeCompare(right.version));

    // 1. Calculate base line totals (above).
    // 2. Apply item-level surcharges/discounts.
    for (const rule of orderedRules) {
      if (rule.scope === 'ORDER') continue;
      this.applyRule(rule, 'ITEM', safeInput, lines, baseSubtotalMinor, adjustments, applied);
    }
    // 3. Calculate subtotal after item adjustments.
    const subtotalMinor = this.totalAfter(adjustments, baseSubtotalMinor, 'ITEM');
    // 4. Apply order-level discounts/surcharges.
    for (const rule of orderedRules) {
      if (rule.scope === 'ITEM') continue;
      this.applyRule(rule, 'ORDER', safeInput, lines, subtotalMinor, adjustments, applied);
    }
    // 5. Apply currency rounding. All values are already minor-unit integers;
    // percentage rules use integer basis points and explicit rounding modes.
    // 6. Produce a non-negative final total.
    const totalMinor = Math.max(0, this.totalAfter(adjustments, subtotalMinor, 'ORDER'));
    return Object.freeze({
      currency: safeInput.currency,
      lines: Object.freeze(lines),
      subtotalMinor,
      adjustments: Object.freeze(adjustments),
      totalMinor,
      ruleVersion: RULE_VERSION,
    });
  }

  private applyRule(
    rule: PricingRule,
    phase: PricingRuleScope,
    input: PricingInput,
    lines: readonly PricingLine[],
    subtotalMinor: number,
    adjustments: PricingAdjustment[],
    applied: Set<string>,
  ): void {
    const key = `${rule.code}:${phase}`;
    if (applied.has(key)) return;
    applied.add(key);
    const context: PricingContext = immutableClone({ input, lines, subtotalMinor, phase });
    const produced = rule.apply(context);
    for (const adjustment of produced) {
      if (adjustment.scope !== phase) throw new Error(`Rule ${rule.code} returned an invalid scope for ${phase}`);
      if (adjustment.amountMinor < 0 || !Number.isSafeInteger(adjustment.amountMinor)) throw new Error(`Rule ${rule.code} returned an invalid amount`);
      if (adjustment.scope === 'ITEM' && !lines.some((line) => line.itemRef === adjustment.itemRef)) throw new Error(`Rule ${rule.code} referenced an unknown item`);
      adjustments.push(Object.freeze({ ...adjustment, ruleVersion: rule.version }));
    }
  }

  private totalAfter(adjustments: readonly PricingAdjustment[], startingMinor: number, scope: PricingAdjustmentScope): number {
    let total = startingMinor;
    for (const adjustment of adjustments) {
      if (adjustment.scope !== scope) continue;
      total += adjustment.type === 'SURCHARGE' ? adjustment.amountMinor : -adjustment.amountMinor;
    }
    return total;
  }

  private sum(values: readonly number[]): number {
    const total = values.reduce((sum, value) => sum + value, 0);
    assertNonNegativeInteger(total, 'totalMinor');
    return total;
  }
}
