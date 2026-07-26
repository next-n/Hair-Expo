import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const processingClaimTokenMigration: Migration = {
  id: '011-processing-claim-token',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE checkout_operations ADD COLUMN processing_claim_token TEXT;
  `),
};
