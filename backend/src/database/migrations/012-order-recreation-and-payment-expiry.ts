import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const orderRecreationAndPaymentExpiryMigration: Migration = {
  id: '012-order-recreation-and-payment-expiry',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE orders ADD COLUMN recreated_from_order_id TEXT REFERENCES orders(id);
    ALTER TABLE order_items ADD COLUMN variant_id TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN payment_link_created_at TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN payment_link_expires_at TEXT;
    CREATE INDEX idx_orders_recreated_from_order_id ON orders(recreated_from_order_id);
    CREATE INDEX idx_checkout_attempts_payment_link_expiry ON checkout_attempts(payment_link_expires_at);
  `),
};
