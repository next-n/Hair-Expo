import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { Inject } from '@nestjs/common';
import { CheckoutResult as ProviderCheckoutResult, PAYMENT_PROVIDER, PaymentProvider } from '../payment-provider/payment-provider';
import { PricingService } from '../pricing/pricing.service';

type CheckoutOperationRow = {
  id: string;
  client_idempotency_key: string;
  request_hash: string;
  request_json: string;
  status: string;
  order_id: string | null;
  response_json: string | null;
  total_amount_minor: number | null;
  currency: string | null;
  pricing_rule_version: string | null;
  created_at: string;
  updated_at: string;
};

type CheckoutResult = {
  operationId: string;
  status: string;
  totalAmountMinor: number | null;
  currency: string | null;
  checkoutUrl: string | null;
};

@Injectable()
export class CheckoutCoreService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pricingService: PricingService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async process(operationId: string): Promise<CheckoutResult> {
    const claimed = this.claim(operationId);
    if (claimed.status === 'completed') return this.toResult(claimed);
    if (claimed.status !== 'processing') {
      throw new ConflictException(`Checkout operation is already ${claimed.status}`);
    }

    const request = JSON.parse(claimed.request_json) as {
      currency: string;
      items: Array<{ productId: string; variantId?: string; quantity: number; weightGrams?: number; color?: string; lengthInches?: number }>;
    };
    const pricing = this.pricingService.calculate({
      currency: request.currency,
      items: request.items.map((item, index) => ({ itemRef: `item-${index + 1}`, ...item })),
    });
    const providerIdempotencyKey = `checkout:${operationId}:attempt:1`;
    const attemptId = randomUUID();
    const orderId = randomUUID();
    const orderNumber = `EXPO-${orderId.slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    this.database.connection.transaction(() => {
      this.database.connection.prepare(`
        INSERT INTO orders (id, order_number, status, currency, total_amount_minor, created_at, updated_at)
        VALUES (?, ?, 'payment_pending', ?, ?, ?, ?)
      `).run(orderId, orderNumber, request.currency, pricing.totalMinor, now, now);
      const updated = this.database.connection.prepare(`
        UPDATE checkout_operations
        SET status = 'payment_pending', total_amount_minor = ?, currency = ?, pricing_rule_version = ?, order_id = ?, updated_at = ?
        WHERE id = ? AND status = 'processing'
      `).run(pricing.totalMinor, request.currency, pricing.ruleVersion, orderId, now, operationId);
      if (updated.changes !== 1) throw new ConflictException('Checkout operation is no longer claimable');
      const insertItem = this.database.connection.prepare(`
        INSERT INTO order_items
          (id, order_id, product_id, sku_snapshot, name_snapshot, quantity, unit_amount_minor,
           currency, line_total_amount_minor, pricing_metadata_json, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const orderItemIds: string[] = [];
      for (const [index, line] of pricing.lines.entries()) {
        const source = request.items[index];
        const orderItemId = randomUUID();
        orderItemIds.push(orderItemId);
        insertItem.run(orderItemId, orderId, source.variantId ?? source.productId, source.variantId ?? source.productId,
          line.quantity, line.unitPriceMinor, request.currency, line.lineTotalMinor,
          JSON.stringify({ weightGrams: source.weightGrams, color: source.color, lengthInches: source.lengthInches }), now);
      }
      const insertAdjustment = this.database.connection.prepare(`
        INSERT INTO pricing_adjustments
          (id, checkout_operation_id, order_id, order_item_id, code, label, type, scope, item_ref,
           amount_minor, rule_version, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const adjustment of pricing.adjustments) {
        const itemIndex = adjustment.itemRef?.match(/^item-(\d+)$/)?.[1];
        const orderItemId = itemIndex ? orderItemIds[Number(itemIndex) - 1] ?? null : null;
        insertAdjustment.run(randomUUID(), operationId, orderId, orderItemId, adjustment.code, adjustment.label,
          adjustment.type, adjustment.scope, adjustment.itemRef ?? null, adjustment.amountMinor,
          adjustment.ruleVersion, adjustment.metadata ? JSON.stringify(adjustment.metadata) : null, now);
      }
      this.database.connection.prepare(`
        INSERT INTO checkout_attempts
          (id, checkout_operation_id, attempt_number, provider_name, provider_idempotency_key,
           status, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, 'pending', ?, ?)
      `).run(attemptId, operationId, this.paymentProvider.name, providerIdempotencyKey, now, now);
    })();

    let providerResult: ProviderCheckoutResult;
    try {
      providerResult = await this.paymentProvider.createCheckout({
        paymentAttemptId: attemptId,
        providerIdempotencyKey,
        amountMinor: pricing.totalMinor,
        currency: request.currency,
      });
    } catch (error) {
      return this.saveFailure(operationId, attemptId, orderId, error);
    }
    return this.saveProviderResult(operationId, attemptId, providerResult, pricing.totalMinor, request.currency, orderId);
  }

  private claim(operationId: string): CheckoutOperationRow {
    const result = this.database.connection.transaction(() => {
      this.database.connection.prepare(`
        UPDATE checkout_operations SET status = 'processing', updated_at = ?
        WHERE id = ? AND status = 'received'
      `).run(new Date().toISOString(), operationId);
      return this.database.connection.prepare(`
        SELECT id, client_idempotency_key, request_hash, request_json, status, order_id,
               response_json, total_amount_minor, currency, pricing_rule_version, created_at, updated_at
        FROM checkout_operations WHERE id = ?
      `).get(operationId) as CheckoutOperationRow | undefined;
    })();
    if (!result) throw new NotFoundException('Checkout operation not found');
    return result;
  }

  private saveProviderResult(
    operationId: string,
    attemptId: string,
    result: ProviderCheckoutResult,
    totalAmountMinor: number,
    currency: string,
    orderId: string,
  ): CheckoutResult {
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      const status = result.status === 'created' ? 'completed' : 'failed';
      const response = result.checkoutUrl ? { checkoutUrl: result.checkoutUrl } : null;
      this.database.connection.prepare(`
        UPDATE checkout_operations SET status = ?, response_json = ?, updated_at = ?
        WHERE id = ? AND status = 'payment_pending'
      `).run(status, response ? JSON.stringify(response) : null, now, operationId);
      this.database.connection.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
        .run(status === 'completed' ? 'paid' : 'failed', now, orderId);
      this.database.connection.prepare(`
        UPDATE checkout_attempts SET status = ?, provider_reference = ?, checkout_url = ?,
          error_code = ?, error_message = ?, updated_at = ? WHERE id = ?
      `).run(status, result.providerReference ?? null, result.checkoutUrl ?? null,
        result.errorCode ?? null, result.errorMessage ?? null, now, attemptId);
      return { operationId, status, totalAmountMinor, currency, checkoutUrl: result.checkoutUrl ?? null };
    })();
  }

  private saveFailure(operationId: string, attemptId: string, orderId: string, error: unknown): CheckoutResult {
    const result = error instanceof Error ? error.message : 'Payment provider failed';
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      this.database.connection.prepare(`UPDATE checkout_operations SET status = 'failed', updated_at = ?
        WHERE id = ? AND status = 'payment_pending'`).run(now, operationId);
      this.database.connection.prepare(`UPDATE checkout_attempts SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ?`).run(result, now, attemptId);
      this.database.connection.prepare('UPDATE orders SET status = \'failed\', updated_at = ? WHERE id = ?').run(now, orderId);
      return { operationId, status: 'failed', totalAmountMinor: null, currency: null, checkoutUrl: null };
    })();
  }

  private toResult(operation: CheckoutOperationRow): CheckoutResult {
    const response = operation.response_json ? JSON.parse(operation.response_json) as { checkoutUrl?: string } : {};
    return {
      operationId: operation.id,
      status: operation.status,
      totalAmountMinor: operation.total_amount_minor,
      currency: operation.currency,
      checkoutUrl: response.checkoutUrl ?? null,
    };
  }

  get(operationId: string): CheckoutResult {
    const operation = this.database.connection.prepare(`
      SELECT id, client_idempotency_key, request_hash, request_json, status, order_id,
             response_json, total_amount_minor, currency, pricing_rule_version, created_at, updated_at
      FROM checkout_operations WHERE id = ?
    `).get(operationId) as CheckoutOperationRow | undefined;
    if (!operation) throw new NotFoundException('Checkout operation not found');
    return this.toResult(operation);
  }
}
