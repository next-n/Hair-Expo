import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const mockVerticalSchemaMigration: Migration = {
  id: '004-mock-vertical-schema',
  up: (db: Database.Database) => db.exec(`
    CREATE TABLE booth_sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      attributes_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
    CREATE TABLE pricing_adjustments (
      id TEXT PRIMARY KEY,
      checkout_operation_id TEXT REFERENCES checkout_operations(id),
      order_id TEXT REFERENCES orders(id),
      order_item_id TEXT REFERENCES order_items(id),
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SURCHARGE', 'DISCOUNT')),
      scope TEXT NOT NULL CHECK (scope IN ('ITEM', 'ORDER')),
      item_ref TEXT,
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      rule_version TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_pricing_adjustments_operation ON pricing_adjustments(checkout_operation_id);
  `),
};
