import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATABASE_PATH } from './database.module';
import { runMigrations } from './migrations/migration-runner';
import { migrations } from './migrations';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly connection: Database.Database;

  constructor(@Inject(DATABASE_PATH) databasePath: string) {
    const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);
    if (resolvedPath !== ':memory:') mkdirSync(dirname(resolvedPath), { recursive: true });
    this.connection = new Database(resolvedPath);
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('busy_timeout = 5000');
    this.connection.pragma('synchronous = FULL');
  }

  onModuleInit(): void {
    runMigrations(this.connection, migrations);
  }

  onModuleDestroy(): void {
    this.connection.close();
  }
}
