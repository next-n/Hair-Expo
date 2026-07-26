import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const pricingVersionMigration: Migration = {
  id: '006-pricing-version',
  up: (db: Database.Database) => db.exec(`ALTER TABLE checkout_operations ADD COLUMN pricing_rule_version TEXT`),
};
