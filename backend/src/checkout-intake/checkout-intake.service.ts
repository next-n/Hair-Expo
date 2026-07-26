import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { buildCanonicalCheckoutRequest, canonicalJson, checkoutRequestHash } from './canonical-request';
import { CheckoutIntakeRequestDto } from './checkout-intake.dto';
import { CHECKOUT_LIMITS } from './request-limits';

const OPERATION_TYPE = 'checkout_intake';

type CheckoutOperationRow = {
  id: string;
  actor_id: string;
  operation_type: string;
  client_idempotency_key: string;
  request_hash: string;
  request_json: string;
  status: string;
  order_id: string | null;
  response_json: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckoutIntakeResult = {
  operation: CheckoutOperationRow;
  created: boolean;
};

@Injectable()
export class CheckoutIntakeService {
  constructor(private readonly database: DatabaseService) {}

  intake(actorId: string, idempotencyKey: string, request: CheckoutIntakeRequestDto): CheckoutIntakeResult {
    if (request.items.length < 1 || request.items.length > CHECKOUT_LIMITS.maxItems) throw new BadRequestException('Checkout must contain between 1 and 100 items');
    for (const item of request.items) {
      if (item.quantity < 1 || item.quantity > CHECKOUT_LIMITS.maxQuantity) throw new BadRequestException('Quantity is outside the allowed range');
      if (item.weightGrams !== undefined && (item.weightGrams < 0 || item.weightGrams > CHECKOUT_LIMITS.maxWeightGrams)) throw new BadRequestException('Weight is outside the allowed range');
      if (item.lengthInches !== undefined && (item.lengthInches < 0 || item.lengthInches > CHECKOUT_LIMITS.maxLengthInches)) throw new BadRequestException('Length is outside the allowed range');
      if (item.color !== undefined && item.color.length > CHECKOUT_LIMITS.maxColorLength) throw new BadRequestException('Color is too long');
    }
    const canonicalRequest = buildCanonicalCheckoutRequest(request);
    const requestJson = canonicalJson(canonicalRequest);
    const requestHash = checkoutRequestHash(requestJson);
    const now = new Date().toISOString();

    const result = this.database.connection.transaction(() => {
      const insert = this.database.connection.prepare(`
        INSERT INTO checkout_operations
          (id, actor_id, operation_type, client_idempotency_key, request_hash,
           request_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (actor_id, operation_type, client_idempotency_key) DO NOTHING
      `).run(
        randomUUID(), actorId, OPERATION_TYPE, idempotencyKey, requestHash,
        requestJson, 'received', now, now,
      );
      const operation = this.database.connection.prepare(`
        SELECT id, actor_id, operation_type, client_idempotency_key, request_hash,
               request_json, status, order_id, response_json, created_at, updated_at
        FROM checkout_operations
        WHERE actor_id = ? AND operation_type = ? AND client_idempotency_key = ?
      `).get(actorId, OPERATION_TYPE, idempotencyKey) as CheckoutOperationRow;
      return { operation, created: insert.changes === 1 };
    })();

    if (result.operation.request_hash !== requestHash) {
      throw new ConflictException('Idempotency-Key was already used with a different request');
    }
    return result;
  }
}
