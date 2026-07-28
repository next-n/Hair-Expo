import { ConflictException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { isPaymentLinkExpired, paymentLinkExpiresAt } from '../checkout-core/payment-link-expiry';
import { DatabaseService } from '../database/database.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payment-provider/payment-provider';

type OrderStatusFilter = 'paid' | 'pending' | 'all';

type PaymentLinkSnapshot = {
  checkoutUrl: string | null;
  providerReference: string | null;
  paymentLinkCreatedAt: string | null;
  paymentLinkExpiresAt: string | null;
  paymentLinkDeactivatedAt: string | null;
};

type PaymentOrderRow = {
  status: string;
  currency: string;
  total_amount_minor: number;
  stripe_payment_link_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_link_deactivated_at: string | null;
};

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  onModuleInit(): void {
    this.expiryTimer = setInterval(() => void this.expirePaymentLinks(), 60_000);
    this.expiryTimer.unref();
    void this.expirePaymentLinks();
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  list(status: OrderStatusFilter = 'all', from?: string, to?: string) {
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (status === 'paid') clauses.push("status = 'paid'");
    if (status === 'pending') clauses.push("status IN ('pending', 'review_required')");
    if (from) { this.assertDate(from); clauses.push('created_at >= ?'); parameters.push(from); }
    if (to) { this.assertDate(to); clauses.push('created_at < ?'); parameters.push(to); }
    if (from && to && from >= to) throw new ConflictException('The order date range is invalid');
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orders = this.database.connection.prepare(`
      SELECT id, order_number AS orderNumber, customer_name AS customerName,
        customer_contact AS customerContact, created_at AS createdAt, currency,
        total_amount_minor AS totalAmountMinor, total_cny_minor AS totalCnyMinor,
        subtotal_amount_minor AS subtotalMinor, surcharge_amount_minor AS surchargeMinor,
        discount_amount_minor AS discountMinor, subtotal_cny_minor AS subtotalCnyMinor,
        surcharge_cny_minor AS surchargeCnyMinor, discount_cny_minor AS discountCnyMinor,
        total_weight_grams AS totalWeightGrams,
        selected_discount_reason AS selectedDiscountReason, status AS paymentStatus,
        stripe_payment_link_id AS paymentLinkId, stripe_checkout_session_id AS checkoutSessionId,
        stripe_payment_link_deactivated_at AS paymentLinkDeactivatedAt,
        recreated_from_order_id AS recreatedFromOrderId
      FROM orders ${where} ORDER BY created_at DESC
    `).all(...parameters) as Array<Record<string, unknown> & { id: string }>;
    return orders.map((order) => this.withPaymentLink(order));
  }

  get(orderId: string) {
    const order = this.database.connection.prepare(`
      SELECT id, order_number AS orderNumber, customer_name AS customerName,
        customer_contact AS customerContact, created_at AS createdAt, currency,
        total_amount_minor AS totalAmountMinor, total_cny_minor AS totalCnyMinor,
        subtotal_amount_minor AS subtotalMinor, surcharge_amount_minor AS surchargeMinor,
        discount_amount_minor AS discountMinor, subtotal_cny_minor AS subtotalCnyMinor,
        surcharge_cny_minor AS surchargeCnyMinor, discount_cny_minor AS discountCnyMinor,
        total_weight_grams AS totalWeightGrams,
        selected_discount_reason AS selectedDiscountReason, status AS paymentStatus,
        stripe_payment_link_id AS paymentLinkId, stripe_checkout_session_id AS checkoutSessionId,
        stripe_payment_link_deactivated_at AS paymentLinkDeactivatedAt,
        recreated_from_order_id AS recreatedFromOrderId
      FROM orders WHERE id = ?
    `).get(orderId) as (Record<string, unknown> & { id: string }) | undefined;
    if (!order) throw new NotFoundException('Order not found');
    const items = this.database.connection.prepare(`
      SELECT COALESCE(oi.product_id, (
          SELECT pv.product_id FROM product_variants pv WHERE pv.sku = oi.sku_snapshot LIMIT 1
        )) AS productId,
        COALESCE(oi.variant_id, (
          SELECT pv.id FROM product_variants pv WHERE pv.sku = oi.sku_snapshot LIMIT 1
        )) AS variantId,
        oi.sku_snapshot AS sku, oi.name_snapshot AS name, oi.line, oi.product_type AS productType,
        oi.length_in AS lengthIn, oi.unit, oi.quantity, oi.blonde,
        oi.base_unit_amount_minor AS baseUnitAmountMinor,
        oi.base_unit_amount_cny_minor AS baseUnitAmountCnyMinor,
        oi.adjusted_unit_amount_minor AS adjustedUnitAmountMinor,
        oi.adjusted_unit_amount_cny_minor AS adjustedUnitAmountCnyMinor,
        oi.line_total_amount_minor AS lineTotalMinor, oi.line_total_cny_minor AS lineTotalCnyMinor,
        oi.weight_contribution_grams AS weightContributionGrams
      FROM order_items oi WHERE oi.order_id = ? ORDER BY oi.rowid
    `).all(orderId);
    const adjustments = this.database.connection.prepare(`
      SELECT code, label, type, scope, item_ref AS itemRef, amount_minor AS amountMinor,
        amount_cny_minor AS amountCnyMinor, rule_version AS ruleVersion, metadata_json AS metadataJson
      FROM pricing_adjustments WHERE order_id = ? ORDER BY rowid
    `).all(orderId).map((adjustment) => {
      const row = adjustment as { metadataJson: string | null } & Record<string, unknown>;
      return { ...row, metadata: row.metadataJson ? JSON.parse(row.metadataJson) : undefined, metadataJson: undefined };
    });
    return { ...this.withPaymentLink(order), items, adjustments };
  }

  async refresh(orderId: string) {
    const row = this.database.connection.prepare(`
      SELECT status, currency, total_amount_minor, stripe_payment_link_id,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_link_deactivated_at
      FROM orders WHERE id = ?
    `).get(orderId) as PaymentOrderRow | undefined;
    if (!row) throw new NotFoundException('Order not found');
    if (row.status === 'paid' || !row.stripe_payment_link_id) return this.get(orderId);
    const status = await this.paymentProvider.retrieveCheckout(row.stripe_payment_link_id);
    if (status.status === 'created' && status.checkoutSessionId) {
      this.assertPaymentMatchesOrder(status, row, row.stripe_payment_link_id);
      this.markPaid(orderId, status.checkoutSessionId, status.paymentIntentId ?? null, row.stripe_payment_link_id, 'manual_refresh');
    }
    const current = this.database.connection.prepare('SELECT status, stripe_payment_link_deactivated_at FROM orders WHERE id = ?').get(orderId) as { status: string; stripe_payment_link_deactivated_at: string | null };
    if (current.status === 'paid' && !current.stripe_payment_link_deactivated_at) await this.deactivatePaymentLink(orderId, row.stripe_payment_link_id, 'manual_refresh');
    return this.get(orderId);
  }

  markPaid(orderId: string, checkoutSessionId: string | null, paymentIntentId: string | null, paymentLinkId: string | null, source: string): void {
    this.database.connection.transaction(() => {
      const before = this.database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
      if (!before) throw new NotFoundException('Order not found');
      if (before.status === 'paid') return;
      const updated = this.database.connection.prepare(`
        UPDATE orders SET status = 'paid', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
          stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), stripe_payment_link_id = COALESCE(?, stripe_payment_link_id), updated_at = ?
        WHERE id = ? AND status IN ('pending', 'review_required')
      `).run(checkoutSessionId, paymentIntentId, paymentLinkId, new Date().toISOString(), orderId);
      if (updated.changes !== 1) {
        const current = this.database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
        if (current?.status === 'paid') return;
        throw new ConflictException('Order state changed before payment confirmation was saved');
      }
      this.audit.record({ action: 'ORDER_PAID', entityType: 'order', entityId: orderId, source, before, after: { status: 'paid' }, metadata: { checkoutSessionId, paymentIntentId, paymentLinkId } });
    })();
  }

  private withPaymentLink<T extends Record<string, unknown> & { id: string }>(order: T): T & PaymentLinkSnapshot & { paymentLinkExpired: boolean } {
    const link = this.readPaymentLink(order.id);
    const expiresAt = link.paymentLinkExpiresAt ?? (link.paymentLinkCreatedAt ? paymentLinkExpiresAt(new Date(link.paymentLinkCreatedAt)) : null);
    return { ...order, ...link, paymentLinkExpiresAt: expiresAt, paymentLinkExpired: Boolean(link.checkoutUrl && isPaymentLinkExpired(expiresAt)) };
  }

  private readPaymentLink(orderId: string): PaymentLinkSnapshot {
    const row = this.database.connection.prepare(`
      SELECT ca.checkout_url AS checkoutUrl, ca.provider_reference AS providerReference,
        ca.payment_link_created_at AS paymentLinkCreatedAt, ca.payment_link_expires_at AS paymentLinkExpiresAt,
        o.stripe_payment_link_deactivated_at AS paymentLinkDeactivatedAt
      FROM checkout_attempts ca JOIN checkout_operations co ON co.id = ca.checkout_operation_id
      JOIN orders o ON o.id = co.order_id
      WHERE co.order_id = ? ORDER BY ca.attempt_number DESC, ca.updated_at DESC LIMIT 1
    `).get(orderId) as PaymentLinkSnapshot | undefined;
    return row ?? { checkoutUrl: null, providerReference: null, paymentLinkCreatedAt: null, paymentLinkExpiresAt: null, paymentLinkDeactivatedAt: null };
  }

  private assertPaymentMatchesOrder(status: { amountMinor?: number; currency?: string; paymentLinkId?: string }, order: PaymentOrderRow, expectedLink: string): void {
    const amountMatches = status.amountMinor === order.total_amount_minor;
    const currencyMatches = status.currency?.toUpperCase() === order.currency.toUpperCase();
    const linkMatches = status.paymentLinkId === expectedLink;
    if (!amountMatches || !currencyMatches || !linkMatches) {
      this.audit.record({ action: 'PAYMENT_VALIDATION_FAILED', entityType: 'order', entityId: expectedLink, source: 'manual_refresh', metadata: { amountMinor: status.amountMinor ?? null, currency: status.currency ?? null, paymentLinkId: status.paymentLinkId ?? null } });
      throw new ConflictException('Payment does not match the local order');
    }
  }

  private async expirePaymentLinks(): Promise<void> {
    const now = new Date().toISOString();
    const candidates = this.database.connection.prepare(`
      SELECT o.id, o.stripe_payment_link_id AS paymentLinkId
      FROM orders o JOIN checkout_operations co ON co.order_id = o.id
      JOIN checkout_attempts ca ON ca.checkout_operation_id = co.id
      WHERE o.status IN ('pending', 'review_required') AND o.stripe_payment_link_id IS NOT NULL
        AND o.stripe_payment_link_deactivated_at IS NULL AND ca.payment_link_expires_at IS NOT NULL
        AND ca.payment_link_expires_at <= ? ORDER BY ca.attempt_number DESC
    `).all(now) as Array<{ id: string; paymentLinkId: string }>;
    for (const candidate of candidates) {
      try {
        const remote = await this.paymentProvider.retrieveCheckout(candidate.paymentLinkId);
        const row = this.database.connection.prepare(`SELECT status, currency, total_amount_minor, stripe_payment_link_id, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_link_deactivated_at FROM orders WHERE id = ?`).get(candidate.id) as PaymentOrderRow | undefined;
        if (!row || row.status === 'paid' || row.stripe_payment_link_deactivated_at) continue;
        if (remote.status === 'created' && remote.checkoutSessionId) {
          this.assertPaymentMatchesOrder(remote, row, candidate.paymentLinkId);
          this.markPaid(candidate.id, remote.checkoutSessionId, remote.paymentIntentId ?? null, candidate.paymentLinkId, 'payment_link_expiry_sweep');
        }
        const current = this.database.connection.prepare('SELECT status, stripe_payment_link_deactivated_at FROM orders WHERE id = ?').get(candidate.id) as { status: string; stripe_payment_link_deactivated_at: string | null } | undefined;
        if (current?.status !== 'paid' || !current.stripe_payment_link_deactivated_at) await this.deactivatePaymentLink(candidate.id, candidate.paymentLinkId, 'payment_link_expiry_sweep');
      } catch (error) {
        this.logger.error(JSON.stringify({ orderId: candidate.id, paymentLinkId: candidate.paymentLinkId, error: error instanceof Error ? error.message : String(error) }), undefined, OrdersService.name);
      }
    }
  }

  private async deactivatePaymentLink(orderId: string, paymentLinkId: string, source: string): Promise<void> {
    try {
      await this.paymentProvider.deactivateCheckout(paymentLinkId);
    } catch (error) {
      this.audit.record({ action: 'PAYMENT_LINK_DEACTIVATION_FAILED', entityType: 'order', entityId: orderId, source, metadata: { paymentLinkId, error: error instanceof Error ? error.message : 'unknown error' } });
      throw new Error('Payment link deactivation failed');
    }
    const now = new Date().toISOString();
    this.database.connection.transaction(() => {
      const updated = this.database.connection.prepare('UPDATE orders SET stripe_payment_link_deactivated_at = ?, updated_at = ? WHERE id = ? AND stripe_payment_link_deactivated_at IS NULL').run(now, now, orderId);
      if (updated.changes === 1) this.audit.record({ action: 'PAYMENT_LINK_DEACTIVATED', entityType: 'order', entityId: orderId, source, metadata: { paymentLinkId } });
    })();
  }

  private assertDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) throw new ConflictException('Order dates must be ISO timestamps');
  }
}
