import Database from 'better-sqlite3';

export type Migration = {
  id: string;
  up: (db: Database.Database) => void;
  transactional?: boolean;
};

export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
  const appliedIds = new Set(applied.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    if (migration.transactional === false) {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
        .run(migration.id, new Date().toISOString());
      continue;
    }
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
        .run(migration.id, new Date().toISOString());
    });
    apply();
  }
}
