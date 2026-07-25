import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const initialMigration: Migration = {
  id: '001-initial',
  up: (db: Database.Database) => db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE price_list_versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      effective_from TEXT,
      effective_to TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE price_list_items (
      price_list_version_id TEXT NOT NULL REFERENCES price_list_versions(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
      created_at TEXT NOT NULL,
      PRIMARY KEY (price_list_version_id, product_id)
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      total_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_minor >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      product_id TEXT REFERENCES products(id),
      sku_snapshot TEXT NOT NULL,
      name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
      currency TEXT NOT NULL,
      line_total_amount_minor INTEGER NOT NULL CHECK (line_total_amount_minor >= 0),
      pricing_metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE checkout_operations (
      id TEXT PRIMARY KEY,
      client_idempotency_key TEXT NOT NULL UNIQUE,
      request_hash TEXT NOT NULL,
      request_json TEXT NOT NULL,
      status TEXT NOT NULL,
      order_id TEXT REFERENCES orders(id),
      response_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE checkout_attempts (
      id TEXT PRIMARY KEY,
      checkout_operation_id TEXT NOT NULL REFERENCES checkout_operations(id),
      attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
      provider_name TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_reference TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (checkout_operation_id, attempt_number)
    );
    CREATE TABLE processed_webhook_events (
      id TEXT PRIMARY KEY,
      provider_name TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      UNIQUE (provider_name, provider_event_id)
    );
    CREATE TABLE audit_records (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      source TEXT NOT NULL,
      actor_id TEXT,
      correlation_id TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX idx_checkout_attempts_operation_id ON checkout_attempts(checkout_operation_id);
    CREATE INDEX idx_audit_records_entity ON audit_records(entity_type, entity_id);
  `),
};
