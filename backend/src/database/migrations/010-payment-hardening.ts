import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const paymentHardeningMigration: Migration = {
  id: '010-payment-hardening',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE checkout_operations ADD COLUMN processing_started_at TEXT;
    ALTER TABLE checkout_operations ADD COLUMN processing_lease_until TEXT;
    ALTER TABLE orders ADD COLUMN stripe_payment_link_deactivated_at TEXT;
    CREATE INDEX idx_checkout_operations_processing_lease ON checkout_operations(status, processing_lease_until);
    CREATE UNIQUE INDEX idx_orders_stripe_checkout_session_id ON orders(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
    CREATE UNIQUE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
    CREATE UNIQUE INDEX idx_orders_stripe_payment_link_id ON orders(stripe_payment_link_id) WHERE stripe_payment_link_id IS NOT NULL;
  `),
};
