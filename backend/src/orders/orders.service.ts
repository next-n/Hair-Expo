import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payment-provider/payment-provider';

@Injectable()
export class OrdersService {
  constructor(private readonly database: DatabaseService, private readonly audit: AuditService, @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider) {}

  list() {
    return this.database.connection.prepare(`SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_contact AS customerContact, created_at AS createdAt, currency, total_amount_minor AS totalAmountMinor, total_cny_minor AS totalCnyMinor, status AS paymentStatus, stripe_payment_link_id AS paymentLinkId FROM orders ORDER BY created_at DESC`).all();
  }

  get(orderId: string) {
    const order = this.database.connection.prepare(`SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_contact AS customerContact, created_at AS createdAt, currency, total_amount_minor AS totalAmountMinor, total_cny_minor AS totalCnyMinor, subtotal_amount_minor AS subtotalMinor, surcharge_amount_minor AS surchargeMinor, discount_amount_minor AS discountMinor, total_weight_grams AS totalWeightGrams, selected_discount_reason AS selectedDiscountReason, status AS paymentStatus, stripe_payment_link_id AS paymentLinkId, stripe_checkout_session_id AS checkoutSessionId FROM orders WHERE id = ?`).get(orderId);
    if (!order) throw new NotFoundException('Order not found');
    const items = this.database.connection.prepare(`SELECT sku_snapshot AS sku, line, product_type AS productType, length_in AS lengthIn, unit, quantity, blonde, base_unit_amount_minor AS baseUnitAmountMinor, base_unit_amount_cny_minor AS baseUnitAmountCnyMinor, adjusted_unit_amount_minor AS adjustedUnitAmountMinor, adjusted_unit_amount_cny_minor AS adjustedUnitAmountCnyMinor, line_total_amount_minor AS lineTotalMinor, line_total_cny_minor AS lineTotalCnyMinor, weight_contribution_grams AS weightContributionGrams FROM order_items WHERE order_id = ? ORDER BY rowid`).all(orderId);
    return { ...order, items };
  }

  async refresh(orderId: string) {
    const row = this.database.connection.prepare('SELECT status, stripe_payment_link_id, stripe_payment_link_deactivated_at FROM orders WHERE id = ?').get(orderId) as { status: string; stripe_payment_link_id: string | null; stripe_payment_link_deactivated_at: string | null } | undefined;
    if (!row) throw new NotFoundException('Order not found');
    if (!row.stripe_payment_link_id) return this.get(orderId);
    const status = await this.paymentProvider.retrieveCheckout(row.stripe_payment_link_id);
    if (status.status === 'created' && status.checkoutSessionId) this.markPaid(orderId, status.checkoutSessionId, status.paymentIntentId ?? null, row.stripe_payment_link_id, 'manual_refresh');
    const current = this.database.connection.prepare('SELECT status, stripe_payment_link_deactivated_at FROM orders WHERE id = ?').get(orderId) as { status: string; stripe_payment_link_deactivated_at: string | null };
    if (current.status === 'paid' && !current.stripe_payment_link_deactivated_at) await this.deactivatePaymentLink(orderId, row.stripe_payment_link_id, 'manual_refresh');
    return this.get(orderId);
  }

  markPaid(orderId: string, checkoutSessionId: string | null, paymentIntentId: string | null, paymentLinkId: string | null, source: string): void {
    this.database.connection.transaction(() => {
      const before = this.database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
      if (!before) throw new NotFoundException('Order not found');
      if (before.status === 'paid') return;
      const updated = this.database.connection.prepare(`UPDATE orders SET status = 'paid', stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), stripe_payment_link_id = COALESCE(?, stripe_payment_link_id), updated_at = ? WHERE id = ? AND status IN ('pending', 'review_required')`).run(checkoutSessionId, paymentIntentId, paymentLinkId, new Date().toISOString(), orderId);
      if (updated.changes !== 1) {
        const current = this.database.connection.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;
        if (current?.status === 'paid') return;
        throw new ConflictException('Order state changed before payment confirmation was saved');
      }
      this.audit.record({ action: 'ORDER_PAID', entityType: 'order', entityId: orderId, source, before, after: { status: 'paid' }, metadata: { checkoutSessionId, paymentIntentId, paymentLinkId } });
    })();
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
}
