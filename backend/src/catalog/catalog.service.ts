import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  line: string;
  productType: string;
  lengthIn: string | null;
  unit: string;
  packWeightGrams: number | null;
  priceUsdMinor: number;
  priceCnyMinor: number;
  tags: string[];
  variants: Array<{ id: string; name: string; sku: string }>;
};

export type CatalogFilter = { search?: string; line?: string; productType?: string; lengthIn?: string };
export type CatalogPrice = CatalogProduct & { variantId: string };

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  listProducts(filter: CatalogFilter = {}): CatalogProduct[] {
    const clauses = ['p.is_active = 1'];
    const params: string[] = [];
    if (filter.line) { clauses.push('p.line = ?'); params.push(filter.line); }
    if (filter.productType) { clauses.push('p.product_type = ?'); params.push(filter.productType); }
    if (filter.lengthIn) { clauses.push('p.length_in = ?'); params.push(filter.lengthIn); }
    if (filter.search) {
      clauses.push('(p.sku LIKE ? OR p.line LIKE ? OR p.product_type LIKE ? OR p.length_in LIKE ?)');
      const search = `%${filter.search}%`;
      params.push(search, search, search, search);
    }
    const products = this.database.connection.prepare(`
      SELECT p.id, p.sku, p.name, p.line, p.product_type, p.length_in, p.unit, p.pack_weight_g,
             p.price_usd_minor, p.price_cny_minor, p.tags_json
      FROM products p WHERE ${clauses.join(' AND ')} ORDER BY p.line, p.product_type, p.length_in, p.sku
    `).all(...params) as Array<{ id: string; sku: string; name: string; line: string; product_type: string; length_in: string | null; unit: string; pack_weight_g: number | null; price_usd_minor: number; price_cny_minor: number; tags_json: string | null }>;
    const variants = this.database.connection.prepare('SELECT id, product_id, name, sku FROM product_variants WHERE is_active = 1').all() as Array<{ id: string; product_id: string; name: string; sku: string }>;
    return products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      line: product.line,
      productType: product.product_type,
      lengthIn: product.length_in,
      unit: product.unit,
      packWeightGrams: product.pack_weight_g,
      priceUsdMinor: product.price_usd_minor,
      priceCnyMinor: product.price_cny_minor,
      tags: product.tags_json ? JSON.parse(product.tags_json) as string[] : [],
      variants: variants.filter((variant) => variant.product_id === product.id).map(({ id, name, sku }) => ({ id, name, sku })),
    }));
  }

  getPrice(productId: string, variantId?: string): CatalogPrice {
    const row = this.database.connection.prepare(`
      SELECT p.id, p.sku, p.name, p.line, p.product_type, p.length_in, p.unit, p.pack_weight_g,
             p.price_usd_minor, p.price_cny_minor, p.tags_json, v.id AS variant_id
      FROM products p JOIN product_variants v ON v.product_id = p.id
      WHERE p.id = ? AND p.is_active = 1 AND v.is_active = 1 ${variantId ? 'AND v.id = ?' : ''}
    `).get(...(variantId ? [productId, variantId] : [productId])) as { id: string; sku: string; name: string; line: string; product_type: string; length_in: string | null; unit: string; pack_weight_g: number | null; price_usd_minor: number; price_cny_minor: number; tags_json: string | null; variant_id: string } | undefined;
    if (!row) throw new NotFoundException('Unknown catalog product or variant');
    return {
      id: row.id, sku: row.sku, name: row.name, line: row.line, productType: row.product_type,
      lengthIn: row.length_in, unit: row.unit, packWeightGrams: row.pack_weight_g,
      priceUsdMinor: row.price_usd_minor, priceCnyMinor: row.price_cny_minor,
      tags: row.tags_json ? JSON.parse(row.tags_json) as string[] : [], variants: [], variantId: row.variant_id,
    };
  }
}
