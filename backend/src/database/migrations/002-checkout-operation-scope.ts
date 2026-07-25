import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const checkoutOperationScopeMigration: Migration = {
  id: '002-checkout-operation-scope',
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
          status TEXT NOT NULL,
          order_id TEXT REFERENCES orders(id),
          response_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (actor_id, operation_type, client_idempotency_key)
        );
        INSERT INTO checkout_operations_new
          (id, actor_id, operation_type, client_idempotency_key, request_hash,
           request_json, status, order_id, response_json, created_at, updated_at)
        SELECT id, 'anonymous', 'checkout_intake', client_idempotency_key, request_hash,
               request_json, status, order_id, response_json, created_at, updated_at
        FROM checkout_operations;
        DROP TABLE checkout_operations;
        ALTER TABLE checkout_operations_new RENAME TO checkout_operations;
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
