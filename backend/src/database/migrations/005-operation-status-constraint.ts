import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const operationStatusConstraintMigration: Migration = {
  id: '005-operation-status-constraint',
  transactional: false,
  up: (db: Database.Database) => {
    db.pragma('foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE checkout_operations_new (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          client_idempotency_key TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          request_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'payment_pending', 'completed', 'failed', 'review_required', 'expired')),
          total_amount_minor INTEGER CHECK (total_amount_minor IS NULL OR total_amount_minor >= 0),
          currency TEXT,
          order_id TEXT REFERENCES orders(id),
          response_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (actor_id, operation_type, client_idempotency_key)
        );
        INSERT INTO checkout_operations_new
          (id, actor_id, operation_type, client_idempotency_key, request_hash, request_json,
           status, total_amount_minor, currency, order_id, response_json, created_at, updated_at)
        SELECT id, actor_id, operation_type, client_idempotency_key, request_hash, request_json,
               status, total_amount_minor, currency, order_id, response_json, created_at, updated_at
        FROM checkout_operations;
        DROP TABLE checkout_operations;
        ALTER TABLE checkout_operations_new RENAME TO checkout_operations;
        CREATE TABLE checkout_attempts_new (
          id TEXT PRIMARY KEY,
          checkout_operation_id TEXT NOT NULL REFERENCES checkout_operations(id),
          attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
          provider_name TEXT NOT NULL,
          provider_idempotency_key TEXT,
          status TEXT NOT NULL,
          provider_reference TEXT,
          checkout_url TEXT,
          error_code TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (checkout_operation_id, attempt_number)
        );
        INSERT INTO checkout_attempts_new
          (id, checkout_operation_id, attempt_number, provider_name, provider_idempotency_key,
           status, provider_reference, checkout_url, error_code, error_message, created_at, updated_at)
        SELECT id, checkout_operation_id, attempt_number, provider_name, provider_idempotency_key,
               status, provider_reference, checkout_url, error_code, error_message, created_at, updated_at
        FROM checkout_attempts;
        DROP TABLE checkout_attempts;
        ALTER TABLE checkout_attempts_new RENAME TO checkout_attempts;
        CREATE TABLE pricing_adjustments_new (
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
        INSERT INTO pricing_adjustments_new
          (id, checkout_operation_id, order_id, order_item_id, code, label, type, scope, item_ref,
           amount_minor, rule_version, metadata_json, created_at)
        SELECT id, checkout_operation_id, order_id, order_item_id, code, label, type, scope, item_ref,
               amount_minor, rule_version, metadata_json, created_at
        FROM pricing_adjustments;
        DROP TABLE pricing_adjustments;
        ALTER TABLE pricing_adjustments_new RENAME TO pricing_adjustments;
        CREATE INDEX idx_checkout_attempts_operation_id ON checkout_attempts(checkout_operation_id);
        CREATE INDEX idx_pricing_adjustments_operation ON pricing_adjustments(checkout_operation_id);
      `);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.pragma('foreign_keys = ON');
    }
  },
};
