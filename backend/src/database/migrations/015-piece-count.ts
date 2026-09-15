import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const pieceCountMigration: Migration = {
  id: '015-piece-count',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE order_items ADD COLUMN pieces_count INTEGER NOT NULL DEFAULT 0 CHECK (pieces_count >= 0);
  `),
};