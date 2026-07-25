import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../src/database/database.service';

describe('database initialization', () => {
  let directory: string;

  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'hair-expo-')); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  it('enables required SQLite pragmas and applies migrations', () => {
    const service = new DatabaseService(join(directory, 'test.sqlite'));
    service.onModuleInit();
    expect(service.connection.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(service.connection.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(service.connection.pragma('busy_timeout', { simple: true })).toBe(5000);
    expect(service.connection.pragma('synchronous', { simple: true })).toBe(2);
    expect(service.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all())
      .toEqual(expect.arrayContaining([
        { name: 'products' }, { name: 'price_list_versions' }, { name: 'orders' },
        { name: 'order_items' }, { name: 'checkout_operations' }, { name: 'checkout_attempts' },
        { name: 'processed_webhook_events' }, { name: 'audit_records' },
      ]));
    service.onModuleDestroy();
  });

  it('runs an applied migration only once', () => {
    const service = new DatabaseService(join(directory, 'test.sqlite'));
    service.onModuleInit();
    service.onModuleInit();
    expect(service.connection.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get())
      .toEqual({ count: 1 });
    service.onModuleDestroy();
  });
});

describe('migration schema constraints', () => {
  it('stores money as integer columns and deduplicates webhook events', () => {
    const service = new DatabaseService(':memory:');
    service.onModuleInit();
    const column = service.connection.prepare('PRAGMA table_info(order_items)').all()
      .find((row) => (row as { name: string }).name === 'unit_amount_minor') as { type: string };
    expect(column.type).toBe('INTEGER');
    service.connection.prepare(`INSERT INTO processed_webhook_events
      (id, provider_name, provider_event_id, event_type, payload_json, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run('event-1', 'fake', 'provider-event-1', 'test', '{}', new Date().toISOString());
    expect(() => service.connection.prepare(`INSERT INTO processed_webhook_events
      (id, provider_name, provider_event_id, event_type, payload_json, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run('event-2', 'fake', 'provider-event-1', 'test', '{}', new Date().toISOString()))
      .toThrow();
    service.onModuleDestroy();
  });
});
