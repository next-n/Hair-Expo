import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const catalogFixturesMigration: Migration = {
  id: '007-catalog-fixtures',
  up: (db: Database.Database) => {
    db.exec(`ALTER TABLE products ADD COLUMN product_type TEXT; ALTER TABLE products ADD COLUMN tags_json TEXT;`);
    db.exec(`
      INSERT OR IGNORE INTO products (id, sku, name, description, product_type, tags_json, created_at, updated_at)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'EXPO-STRAIGHT', 'Expo Straight Bundle', 'Development fixture', 'bundle', '["expo","straight"]', datetime('now'), datetime('now')),
        ('11111111-1111-4111-8111-222222222222', 'EXPO-WAVE', 'Demo Wave Bundle', 'Development fixture', 'bundle', '["expo","wave"]', datetime('now'), datetime('now'));
      INSERT OR IGNORE INTO product_variants (id, product_id, sku, name, attributes_json, created_at, updated_at)
      VALUES
        ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'EXPO-STRAIGHT-18', '18 inch', '{}', datetime('now'), datetime('now')),
        ('21111111-1111-4111-8111-222222222222', '11111111-1111-4111-8111-222222222222', 'EXPO-WAVE-20', '20 inch', '{}', datetime('now'), datetime('now'));
    `);
  },
};
