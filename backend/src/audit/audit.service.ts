import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  record(input: { action: string; entityType: string; entityId: string; source: string; actorId?: string; correlationId?: string; before?: unknown; after?: unknown; metadata?: unknown }): void {
    this.database.connection.prepare(`
      INSERT INTO audit_records (id, action, entity_type, entity_id, source, actor_id, correlation_id, before_json, after_json, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), input.action, input.entityType, input.entityId, input.source, input.actorId ?? null, input.correlationId ?? null,
      input.before === undefined ? null : JSON.stringify(input.before), input.after === undefined ? null : JSON.stringify(input.after), input.metadata === undefined ? null : JSON.stringify(input.metadata), new Date().toISOString());
  }
}
