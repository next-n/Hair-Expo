import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';

const REQUIRED_COLUMNS = ['sku', 'line', 'product_type', 'length_in', 'unit', 'pack_weight_g', 'price_usd', 'price_cny'] as const;
const SUPPORTED_UNITS = new Set(['pack_100pcs', 'pack_20pcs', 'pack', 'per_100g', 'per_kg']);
const EXPECTED_ROW_COUNT = 75;

type CatalogRow = {
  sku: string;
  line: string;
  product_type: string;
  length_in: string;
  unit: string;
  pack_weight_g: string;
  price_usd: string;
  price_cny: string;
};

export type CatalogImportSummary = { rowCount: number; checksum: string; version: string };

function stableId(prefix: string, value: string): string {
  const hex = createHash('sha256').update(`${prefix}:${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function parseCsv(raw: string): CatalogRow[] {
  const lines = raw.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines.shift()?.split(',');
  if (!header || header.length !== REQUIRED_COLUMNS.length || header.some((value, index) => value !== REQUIRED_COLUMNS[index])) {
    throw new Error('Catalog CSV has invalid required columns');
  }
  const rows = lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== REQUIRED_COLUMNS.length) throw new Error(`Catalog CSV row ${index + 2} has invalid column count`);
    return Object.fromEntries(REQUIRED_COLUMNS.map((column, columnIndex) => [column, values[columnIndex]])) as unknown as CatalogRow;
  });
  if (rows.length !== EXPECTED_ROW_COUNT) throw new Error(`Catalog CSV must contain exactly ${EXPECTED_ROW_COUNT} products`);
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.sku || seen.has(row.sku)) throw new Error('Catalog CSV contains an empty or duplicate SKU');
    seen.add(row.sku);
    if (!row.line || !row.product_type || !SUPPORTED_UNITS.has(row.unit)) throw new Error(`Catalog CSV has invalid labels or unit for ${row.sku}`);
    for (const [field, value] of [['price_usd', row.price_usd], ['price_cny', row.price_cny]] as const) {
      if (!/^\d+$/.test(value) || Number(value) <= 0) throw new Error(`Catalog CSV has an invalid ${field} for ${row.sku}`);
    }
    if (row.length_in && !/^\d+(?:-\d+)?$/.test(row.length_in)) throw new Error(`Catalog CSV has an invalid length for ${row.sku}`);
    if (row.pack_weight_g && (!/^\d+$/.test(row.pack_weight_g) || Number(row.pack_weight_g) <= 0)) throw new Error(`Catalog CSV has an invalid weight for ${row.sku}`);
  }
  return rows;
}

@Injectable()
export class CatalogImportService implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.importFromFile(process.env.CATALOG_CSV_PATH ?? resolve(process.cwd(), 'data/trunov_price_list.csv'));
  }

  importFromFile(filePath: string): CatalogImportSummary {
    const raw = readFileSync(filePath);
    const checksum = createHash('sha256').update(raw).digest('hex');
    const rows = parseCsv(raw.toString('utf8'));
    const version = `trunov-${checksum.slice(0, 12)}`;
    const now = new Date().toISOString();
    this.database.connection.transaction(() => {
      this.database.connection.prepare(`UPDATE products SET is_active = 0, updated_at = ?`).run(now);
      this.database.connection.prepare(`UPDATE product_variants SET is_active = 0, updated_at = ?`).run(now);
      this.database.connection.prepare(`UPDATE price_list_versions SET status = 'superseded', effective_to = ? WHERE status = 'active'`).run(now);
      const versionId = stableId('price-list-version', checksum);
      this.database.connection.prepare(`
        INSERT INTO price_list_versions (id, version, currency, status, effective_from, source_checksum, source_name, created_at)
        VALUES (?, ?, 'USD,CNY', 'active', ?, ?, 'trunov_price_list.csv', ?)
        ON CONFLICT(version) DO UPDATE SET status = 'active', effective_to = NULL
      `).run(versionId, version, now, checksum, now);
      const currentVersionId = this.database.connection.prepare('SELECT id FROM price_list_versions WHERE version = ?').get(version) as { id: string };
      const product = this.database.connection.prepare(`
        INSERT INTO products (id, sku, name, description, product_type, tags_json, line, length_in, unit, pack_weight_g, price_usd_minor, price_cny_minor, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET name = excluded.name, description = excluded.description,
          product_type = excluded.product_type, tags_json = excluded.tags_json, line = excluded.line,
          length_in = excluded.length_in, unit = excluded.unit, pack_weight_g = excluded.pack_weight_g,
          price_usd_minor = excluded.price_usd_minor, price_cny_minor = excluded.price_cny_minor,
          is_active = 1, updated_at = excluded.updated_at
      `);
      const variant = this.database.connection.prepare(`
        INSERT INTO product_variants (id, product_id, sku, name, attributes_json, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET product_id = excluded.product_id, name = excluded.name,
          attributes_json = excluded.attributes_json, is_active = 1, updated_at = excluded.updated_at
      `);
      const price = this.database.connection.prepare(`
        INSERT INTO price_list_items (price_list_version_id, product_id, unit_amount_minor, unit_amount_cny_minor, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(price_list_version_id, product_id) DO UPDATE SET unit_amount_minor = excluded.unit_amount_minor,
          unit_amount_cny_minor = excluded.unit_amount_cny_minor
      `);
      for (const row of rows) {
        const productId = stableId('product', row.sku);
        const variantId = stableId('variant', row.sku);
        const attributes = JSON.stringify({ sku: row.sku, line: row.line, productType: row.product_type, lengthIn: row.length_in || null, unit: row.unit, packWeightGrams: row.pack_weight_g ? Number(row.pack_weight_g) : null, priceUsdMinor: Number(row.price_usd) * 100, priceCnyMinor: Number(row.price_cny) * 100 });
        product.run(productId, row.sku, row.product_type, `${row.line} ${row.product_type}`, row.product_type, JSON.stringify([row.line, row.unit]), row.line, row.length_in || null, row.unit, row.pack_weight_g ? Number(row.pack_weight_g) : null, Number(row.price_usd) * 100, Number(row.price_cny) * 100, now, now);
        variant.run(variantId, productId, row.sku, row.length_in ? `${row.product_type} · ${row.length_in} in` : row.product_type, attributes, now, now);
        price.run(currentVersionId.id, productId, Number(row.price_usd) * 100, Number(row.price_cny) * 100, now);
      }
      this.database.connection.prepare(`DELETE FROM price_list_items WHERE price_list_version_id = ? AND product_id NOT IN (SELECT id FROM products WHERE is_active = 1)`).run(currentVersionId.id);
    })();
    return { rowCount: rows.length, checksum, version };
  }
}
