import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BoothSessionService {
  constructor(private readonly database: DatabaseService) {}

  getOrCreate(candidate?: string): string {
    if (candidate && /^[0-9a-f-]{36}$/i.test(candidate)) {
      const known = this.database.connection.prepare('SELECT id FROM booth_sessions WHERE id = ?').get(candidate);
      if (known) {
        this.database.connection.prepare('UPDATE booth_sessions SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), candidate);
        return candidate;
      }
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.connection.prepare('INSERT INTO booth_sessions (id, created_at, last_seen_at) VALUES (?, ?, ?)').run(id, now, now);
    return id;
  }
}
