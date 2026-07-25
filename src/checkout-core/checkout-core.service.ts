import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { Inject } from '@nestjs/common';
import { PAYMENT_PROVIDER, PaymentProvider, PaymentProviderResult } from '../payment-provider/payment-provider';
import { PRICING_RULE, PricingRule } from '../pricing/pricing-rule';

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
    @Inject(PRICING_RULE)
    private readonly pricingRule: PricingRule,
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
      items: Array<{ productId: string; quantity: number }>;
    };
    const pricing = this.pricingRule.calculate({ currency: request.currency, items: request.items });
    const providerIdempotencyKey = `checkout:${operationId}:attempt:1`;
    const attemptId = randomUUID();
    const now = new Date().toISOString();

    this.database.connection.transaction(() => {
      const updated = this.database.connection.prepare(`
        UPDATE checkout_operations
        SET status = 'payment_pending', total_amount_minor = ?, currency = ?, updated_at = ?
        WHERE id = ? AND status = 'processing'
      `).run(pricing.totalAmountMinor, request.currency, now, operationId);
      if (updated.changes !== 1) throw new ConflictException('Checkout operation is no longer claimable');
      this.database.connection.prepare(`
        INSERT INTO checkout_attempts
          (id, checkout_operation_id, attempt_number, provider_name, provider_idempotency_key,
           status, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, 'pending', ?, ?)
      `).run(attemptId, operationId, this.paymentProvider.name, providerIdempotencyKey, now, now);
    })();

    let providerResult: PaymentProviderResult;
    try {
      providerResult = await this.paymentProvider.createCheckoutSession({
        paymentAttemptId: attemptId,
        providerIdempotencyKey,
        amountMinor: pricing.totalAmountMinor,
        currency: request.currency,
      });
    } catch (error) {
      return this.saveFailure(operationId, attemptId, error);
    }
    return this.saveProviderResult(operationId, attemptId, providerResult, pricing.totalAmountMinor, request.currency);
  }

  private claim(operationId: string): CheckoutOperationRow {
    const result = this.database.connection.transaction(() => {
      this.database.connection.prepare(`
        UPDATE checkout_operations SET status = 'processing', updated_at = ?
        WHERE id = ? AND status = 'received'
      `).run(new Date().toISOString(), operationId);
      return this.database.connection.prepare(`
        SELECT id, client_idempotency_key, request_hash, request_json, status, order_id,
               response_json, total_amount_minor, currency, created_at, updated_at
        FROM checkout_operations WHERE id = ?
      `).get(operationId) as CheckoutOperationRow | undefined;
    })();
    if (!result) throw new NotFoundException('Checkout operation not found');
    return result;
  }

  private saveProviderResult(
    operationId: string,
    attemptId: string,
    result: PaymentProviderResult,
    totalAmountMinor: number,
    currency: string,
  ): CheckoutResult {
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      const status = result.status === 'created' ? 'completed' : 'failed';
      const response = result.checkoutUrl ? { checkoutUrl: result.checkoutUrl } : null;
      this.database.connection.prepare(`
        UPDATE checkout_operations SET status = ?, response_json = ?, updated_at = ?
        WHERE id = ? AND status = 'payment_pending'
      `).run(status, response ? JSON.stringify(response) : null, now, operationId);
      this.database.connection.prepare(`
        UPDATE checkout_attempts SET status = ?, provider_reference = ?, checkout_url = ?,
          error_code = ?, error_message = ?, updated_at = ? WHERE id = ?
      `).run(status, result.providerReference ?? null, result.checkoutUrl ?? null,
        result.errorCode ?? null, result.errorMessage ?? null, now, attemptId);
      return { operationId, status, totalAmountMinor, currency, checkoutUrl: result.checkoutUrl ?? null };
    })();
  }

  private saveFailure(operationId: string, attemptId: string, error: unknown): CheckoutResult {
    const result = error instanceof Error ? error.message : 'Payment provider failed';
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      this.database.connection.prepare(`UPDATE checkout_operations SET status = 'failed', updated_at = ?
        WHERE id = ? AND status = 'payment_pending'`).run(now, operationId);
      this.database.connection.prepare(`UPDATE checkout_attempts SET status = 'failed', error_message = ?, updated_at = ?
        WHERE id = ?`).run(result, now, attemptId);
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
}
