import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const realCatalogSchemaMigration: Migration = {
  id: '008-real-catalog-schema',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE products ADD COLUMN line TEXT;
    ALTER TABLE products ADD COLUMN length_in TEXT;
    ALTER TABLE products ADD COLUMN unit TEXT;
    ALTER TABLE products ADD COLUMN pack_weight_g INTEGER;
    ALTER TABLE products ADD COLUMN price_usd_minor INTEGER CHECK (price_usd_minor IS NULL OR price_usd_minor > 0);
    ALTER TABLE products ADD COLUMN price_cny_minor INTEGER CHECK (price_cny_minor IS NULL OR price_cny_minor > 0);
    ALTER TABLE price_list_versions ADD COLUMN source_checksum TEXT;
    ALTER TABLE price_list_versions ADD COLUMN source_name TEXT;
    ALTER TABLE price_list_items ADD COLUMN unit_amount_cny_minor INTEGER CHECK (unit_amount_cny_minor IS NULL OR unit_amount_cny_minor > 0);
    CREATE INDEX idx_products_catalog_filter ON products(is_active, line, product_type, length_in);
  `),
};
