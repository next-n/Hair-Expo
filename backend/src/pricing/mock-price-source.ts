import { Injectable } from '@nestjs/common';
import { BasePriceSource } from './pricing-source';
import { PricingItemInput } from './pricing-rule';

// Non-production example only. Replace with catalog/price-list lookup when the brief arrives.
@Injectable()
export class MockPriceSource implements BasePriceSource {
  getBaseUnitPriceMinor(_item: Omit<PricingItemInput, 'baseUnitPriceMinor'>): number {
    return 100;
  }
}
