import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { BasePriceSource } from './pricing-source';
import { PricingItemInput } from './pricing-rule';

@Injectable()
export class CatalogPriceSource implements BasePriceSource {
  constructor(private readonly catalog: CatalogService) {}

  getBasePrice(item: Omit<PricingItemInput, 'baseUnitPriceMinor'>) {
    const product = this.catalog.getPrice(item.productId, item.variantId);
    return { usdMinor: product.priceUsdMinor, cnyMinor: product.priceCnyMinor, sku: product.sku, line: product.line, productType: product.productType, lengthIn: product.lengthIn, unit: product.unit, packWeightGrams: product.packWeightGrams };
  }

  getBaseUnitPriceMinor(item: Omit<PricingItemInput, 'baseUnitPriceMinor'>): number {
    return this.getBasePrice(item).usdMinor;
  }
}
