import { randomUUID } from 'node:crypto';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { CheckoutIntakeRequestDto } from '../src/checkout-intake/checkout-intake.dto';
import { DatabaseService } from '../src/database/database.service';

function request(): CheckoutIntakeRequestDto {
  return {
    currency: 'usd',
    items: [{ productId: randomUUID(), quantity: 2 }],
  };
}

describe('CheckoutIntakeService', () => {
  let database: DatabaseService;
  let service: CheckoutIntakeService;

  beforeEach(() => {
    database = new DatabaseService(':memory:');
    database.onModuleInit();
    service = new CheckoutIntakeService(database);
  });

  afterEach(() => database.onModuleDestroy());

  it('creates an operation and reuses it for the same key and canonical request', () => {
    const key = randomUUID();
    const first = service.intake('actor-1', key, request());
    const retry = service.intake('actor-1', key, {
      currency: 'USD',
      items: first.operation.request_json ? JSON.parse(first.operation.request_json).items : [],
    });

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.operation.id).toBe(first.operation.id);
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM checkout_operations').get())
      .toEqual({ count: 1 });
  });

  it('rejects empty orders and operationally excessive quantities', () => {
    expect(() => service.intake('actor-1', randomUUID(), { currency: 'USD', items: [] })).toThrow('between 1 and 100 items');
    expect(() => service.intake('actor-1', randomUUID(), { currency: 'USD', items: [{ productId: randomUUID(), quantity: 101 }] })).toThrow('outside the allowed range');
  });

  it('rejects the same key when the canonical request hash differs', () => {
    const key = randomUUID();
    service.intake('actor-1', key, request());
    expect(() => service.intake('actor-1', key, {
      currency: 'USD',
      items: [{ productId: randomUUID(), quantity: 3 }],
    })).toThrow('Idempotency-Key was already used with a different request');
  });

  it('scopes uniqueness by actor and operation type', () => {
    const key = randomUUID();
    const first = service.intake('actor-1', key, request());
    const second = service.intake('actor-2', key, request());
    expect(first.operation.id).not.toBe(second.operation.id);
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM checkout_operations').get())
      .toEqual({ count: 2 });
  });

  it('creates only one operation for concurrent identical requests', async () => {
    const key = randomUUID();
    const body = request();
    const results = await Promise.all(Array.from({ length: 32 }, () =>
      Promise.resolve(service.intake('actor-1', key, body))));

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.operation.id)).size).toBe(1);
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM checkout_operations').get())
      .toEqual({ count: 1 });
  });
});
