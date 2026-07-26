import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
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

export type CheckoutResult = {
  operationId: string;
  orderId?: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  totalAmountMinor: number | null;
  totalCnyMinor?: number | null;
  currency: string | null;
  checkoutUrl: string | null;
  providerReference?: string | null;
  selectedDiscountReason?: string | null;
};

type CheckoutRequest = {
  currency: string;
  customerName?: string;
  customerContact?: string;
  expoDiscountEnabled?: boolean;
  items: Array<{ sku?: string; productId: string; variantId?: string; quantity: number; blonde?: boolean; weightGrams?: number; color?: string; lengthInches?: number }>;
};

@Injectable()
export class CheckoutCoreService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pricingService: PricingService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async process(operationId: string): Promise<CheckoutResult> {
    const claimed = this.claim(operationId);
    if (claimed.status === 'completed') return this.toResult(claimed);
    if (claimed.status !== 'processing') throw new ConflictException(`Checkout operation is already ${claimed.status}`);
    const request = JSON.parse(claimed.request_json) as CheckoutRequest;
    const pricing = this.pricingService.calculate({
      currency: request.currency,
      expoDiscountEnabled: request.expoDiscountEnabled,
      items: request.items.map((item, index) => ({ itemRef: `item-${index + 1}`, ...item })),
    });
    const now = new Date().toISOString();
    const existingOrder = claimed.order_id ? this.database.connection.prepare('SELECT id, order_number FROM orders WHERE id = ?').get(claimed.order_id) as { id: string; order_number: string } | undefined : undefined;
    const orderId = existingOrder?.id ?? randomUUID();
    const orderNumber = existingOrder?.order_number ?? `EXPO-${orderId.slice(0, 8).toUpperCase()}`;
    const existingAttempt = this.database.connection.prepare(`SELECT id, provider_idempotency_key FROM checkout_attempts WHERE checkout_operation_id = ? ORDER BY attempt_number LIMIT 1`).get(operationId) as { id: string; provider_idempotency_key: string | null } | undefined;
    const attemptId = existingAttempt?.id ?? randomUUID();
    const providerIdempotencyKey = existingAttempt?.provider_idempotency_key ?? `trunov:payment-link:${operationId}`;

    this.database.connection.transaction(() => {
      if (!existingOrder) {
        this.database.connection.prepare(`
          INSERT INTO orders (id, order_number, status, currency, total_amount_minor, created_at, updated_at,
            customer_name, customer_contact, total_weight_grams, subtotal_amount_minor, surcharge_amount_minor,
            discount_amount_minor, subtotal_cny_minor, surcharge_cny_minor, discount_cny_minor, total_cny_minor, selected_discount_reason)
          VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, orderNumber, request.currency, pricing.totalMinor, now, now, request.customerName ?? null, request.customerContact ?? null,
          pricing.totalWeightGrams, pricing.subtotalMinor, pricing.surchargeMinor, pricing.discountMinor,
          pricing.subtotalCnyMinor, pricing.surchargeCnyMinor, pricing.discountCnyMinor, pricing.totalCnyMinor, pricing.selectedDiscountReason);
        const insertItem = this.database.connection.prepare(`
          INSERT INTO order_items (id, order_id, product_id, sku_snapshot, name_snapshot, quantity, unit_amount_minor,
            currency, line_total_amount_minor, pricing_metadata_json, created_at, line, product_type, length_in, unit,
            weight_contribution_grams, blonde, base_unit_amount_minor, base_unit_amount_cny_minor,
            adjusted_unit_amount_minor, adjusted_unit_amount_cny_minor, line_total_cny_minor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [index, line] of pricing.lines.entries()) {
          const source = request.items[index];
          const productId = this.database.connection.prepare('SELECT id FROM products WHERE id = ?').get(source.productId) ? source.productId : null;
          insertItem.run(randomUUID(), orderId, productId, line.sku ?? source.sku ?? source.productId, line.productType ?? line.sku ?? source.productId, line.quantity,
            line.adjustedUnitPriceMinor, request.currency, line.lineTotalMinor,
            JSON.stringify({ color: source.color, requestedWeightGrams: source.weightGrams, requestedLengthInches: source.lengthInches }), now,
            line.line, line.productType, line.lengthIn ?? source.lengthInches?.toString() ?? null, line.unit,
            line.weightContributionGrams, line.blonde ? 1 : 0, line.baseUnitPriceMinor, line.baseUnitPriceCnyMinor,
            line.adjustedUnitPriceMinor, line.adjustedUnitPriceCnyMinor, line.lineTotalCnyMinor);
        }
        const insertAdjustment = this.database.connection.prepare(`
          INSERT INTO pricing_adjustments (id, checkout_operation_id, order_id, order_item_id, code, label, type, scope, item_ref, amount_minor, amount_cny_minor, rule_version, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const itemIds = this.database.connection.prepare('SELECT id FROM order_items WHERE order_id = ? ORDER BY rowid').all(orderId) as Array<{ id: string }>;
        for (const adjustment of pricing.adjustments) {
          const itemIndex = adjustment.itemRef?.match(/^item-(\d+)$/)?.[1];
          const orderItemId = itemIndex ? itemIds[Number(itemIndex) - 1]?.id ?? null : null;
          insertAdjustment.run(randomUUID(), operationId, orderId, orderItemId, adjustment.code, adjustment.label, adjustment.type, adjustment.scope,
            adjustment.itemRef ?? null, adjustment.amountMinor, adjustment.amountCnyMinor ?? adjustment.amountMinor, adjustment.ruleVersion,
            adjustment.metadata ? JSON.stringify(adjustment.metadata) : null, now);
        }
      }
      const updated = this.database.connection.prepare(`
        UPDATE checkout_operations SET status = 'payment_pending', total_amount_minor = ?, currency = ?, pricing_rule_version = ?, order_id = ?, updated_at = ?
        WHERE id = ? AND status = 'processing'
      `).run(pricing.totalMinor, request.currency, pricing.ruleVersion, orderId, now, operationId);
      if (updated.changes !== 1) throw new ConflictException('Checkout operation is no longer claimable');
      if (!existingAttempt) {
        this.database.connection.prepare(`
          INSERT INTO checkout_attempts (id, checkout_operation_id, attempt_number, provider_name, provider_idempotency_key, status, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?, 'pending', ?, ?)
        `).run(attemptId, operationId, this.paymentProvider.name, providerIdempotencyKey, now, now);
      } else {
        this.database.connection.prepare(`UPDATE checkout_attempts SET status = 'pending', error_code = NULL, error_message = NULL, updated_at = ? WHERE id = ?`).run(now, attemptId);
      }
    })();

    let providerResult: ProviderCheckoutResult;
    try {
      providerResult = await this.paymentProvider.createCheckout({
        paymentAttemptId: attemptId, providerIdempotencyKey, amountMinor: pricing.totalMinor, currency: request.currency,
        orderId, orderNumber, operationId, frontendUrl: process.env.FRONTEND_URL,
      });
    } catch (error) {
      return this.saveFailure(operationId, attemptId, orderId, error);
    }
    if (providerResult.status !== 'created') return this.saveFailure(operationId, attemptId, orderId, new Error(providerResult.errorCode ?? 'Payment provider failed'));
    return this.saveProviderResult(operationId, attemptId, providerResult, pricing.totalMinor, pricing.totalCnyMinor, request.currency, orderId, orderNumber, pricing.selectedDiscountReason);
  }

  private claim(operationId: string): CheckoutOperationRow {
    const result = this.database.connection.transaction(() => {
      this.database.connection.prepare(`UPDATE checkout_operations SET status = 'processing', updated_at = ? WHERE id = ? AND status IN ('received', 'review_required')`).run(new Date().toISOString(), operationId);
      return this.database.connection.prepare(`SELECT id, client_idempotency_key, request_hash, request_json, status, order_id, response_json, total_amount_minor, currency, pricing_rule_version, created_at, updated_at FROM checkout_operations WHERE id = ?`).get(operationId) as CheckoutOperationRow | undefined;
    })();
    if (!result) throw new NotFoundException('Checkout operation not found');
    return result;
  }

  private saveProviderResult(operationId: string, attemptId: string, result: ProviderCheckoutResult, totalAmountMinor: number, totalCnyMinor: number, currency: string, orderId: string, orderNumber: string, selectedDiscountReason: string | null): CheckoutResult {
    if (result.livemode) return this.saveFailure(operationId, attemptId, orderId, new Error('Stripe returned a live-mode object'));
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      const response = { checkoutUrl: result.checkoutUrl ?? null, providerReference: result.providerReference ?? null, orderId, orderNumber, totalCnyMinor, selectedDiscountReason, providerProductId: result.providerProductId ?? null, providerPriceId: result.providerPriceId ?? null, paymentLinkId: result.paymentLinkId ?? null };
      this.database.connection.prepare(`UPDATE checkout_operations SET status = 'completed', response_json = ?, updated_at = ? WHERE id = ? AND status = 'payment_pending'`).run(JSON.stringify(response), now, operationId);
      this.database.connection.prepare(`UPDATE orders SET status = 'pending', stripe_product_id = ?, stripe_price_id = ?, stripe_payment_link_id = ?, updated_at = ? WHERE id = ?`).run(result.providerProductId ?? null, result.providerPriceId ?? null, result.paymentLinkId ?? result.providerReference ?? null, now, orderId);
      this.database.connection.prepare(`UPDATE checkout_attempts SET status = 'completed', provider_reference = ?, checkout_url = ?, stripe_product_id = ?, stripe_price_id = ?, stripe_payment_link_id = ?, stripe_checkout_session_id = ?, stripe_payment_intent_id = ?, updated_at = ? WHERE id = ?`).run(result.providerReference ?? null, result.checkoutUrl ?? null, result.providerProductId ?? null, result.providerPriceId ?? null, result.paymentLinkId ?? null, result.checkoutSessionId ?? null, result.paymentIntentId ?? null, now, attemptId);
      return { operationId, orderId, orderNumber, status: 'completed', paymentStatus: 'pending', totalAmountMinor, totalCnyMinor, currency, checkoutUrl: result.checkoutUrl ?? null, providerReference: result.providerReference ?? null, selectedDiscountReason };
    })();
  }

  private saveFailure(operationId: string, attemptId: string, orderId: string, error: unknown): CheckoutResult {
    const safeMessage = error instanceof Error && error.message.startsWith('FAKE_') ? error.message : 'Payment provider request did not complete; retry is safe';
    const now = new Date().toISOString();
    return this.database.connection.transaction(() => {
      this.database.connection.prepare(`UPDATE checkout_operations SET status = 'review_required', updated_at = ? WHERE id = ? AND status = 'payment_pending'`).run(now, operationId);
      this.database.connection.prepare(`UPDATE checkout_attempts SET status = 'review_required', error_code = 'PROVIDER_UNCERTAIN', error_message = ?, updated_at = ? WHERE id = ?`).run(safeMessage, now, attemptId);
      this.database.connection.prepare(`UPDATE orders SET status = 'review_required', updated_at = ? WHERE id = ?`).run(now, orderId);
      return { operationId, orderId, status: 'review_required', paymentStatus: 'review_required', totalAmountMinor: null, totalCnyMinor: null, currency: null, checkoutUrl: null };
    })();
  }

  private toResult(operation: CheckoutOperationRow): CheckoutResult {
    const response = operation.response_json ? JSON.parse(operation.response_json) as Partial<CheckoutResult> : {};
    return { operationId: operation.id, orderId: operation.order_id ?? response.orderId, orderNumber: response.orderNumber, status: operation.status, paymentStatus: response.paymentStatus ?? (operation.status === 'completed' ? 'pending' : operation.status), totalAmountMinor: operation.total_amount_minor, totalCnyMinor: response.totalCnyMinor ?? null, currency: operation.currency, checkoutUrl: response.checkoutUrl ?? null, providerReference: response.providerReference ?? null, selectedDiscountReason: response.selectedDiscountReason ?? null };
  }

  get(operationId: string): CheckoutResult {
    const operation = this.database.connection.prepare(`SELECT id, client_idempotency_key, request_hash, request_json, status, order_id, response_json, total_amount_minor, currency, pricing_rule_version, created_at, updated_at FROM checkout_operations WHERE id = ?`).get(operationId) as CheckoutOperationRow | undefined;
    if (!operation) throw new NotFoundException('Checkout operation not found');
    return this.toResult(operation);
  }
}
