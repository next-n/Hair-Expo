import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const checkoutProcessingMigration: Migration = {
  id: '003-checkout-processing',
  up: (db: Database.Database) => {
    db.exec(`
      ALTER TABLE checkout_operations ADD COLUMN total_amount_minor INTEGER
        CHECK (total_amount_minor IS NULL OR total_amount_minor >= 0);
      ALTER TABLE checkout_operations ADD COLUMN currency TEXT;
      ALTER TABLE checkout_attempts ADD COLUMN provider_idempotency_key TEXT;
      ALTER TABLE checkout_attempts ADD COLUMN checkout_url TEXT;
    `);
  },
};
