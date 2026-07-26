import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type CatalogProduct = {
  id: string;
  name: string;
  productType: string;
  tags: string[];
  variants: Array<{ id: string; name: string; sku: string }>;
};

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  listProducts(): CatalogProduct[] {
    const products = this.database.connection.prepare('SELECT id, name, product_type, tags_json FROM products WHERE is_active = 1 ORDER BY name').all() as Array<{ id: string; name: string; product_type: string | null; tags_json: string | null }>;
    const variants = this.database.connection.prepare('SELECT id, product_id, name, sku FROM product_variants WHERE is_active = 1 ORDER BY name').all() as Array<{ id: string; product_id: string; name: string; sku: string }>;
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      productType: product.product_type ?? 'fixture',
      tags: product.tags_json ? JSON.parse(product.tags_json) as string[] : [],
      variants: variants.filter((variant) => variant.product_id === product.id).map(({ id, name, sku }) => ({ id, name, sku })),
    }));
  }
}
