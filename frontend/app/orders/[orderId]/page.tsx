'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../../lib/company';
import { formatMinor, LanguageSwitcher, localizeError, useI18n } from '../../../lib/i18n';
import { printInvoice } from '../../../lib/invoice';
import { CartItem, Order } from '../../../lib/types';

const CART_KEY = 'hair-expo-cart';
const CUSTOMER_KEY = 'hair-expo-customer';
const INTENT_KEY = 'hair-expo-checkout-intent';
const CHECKOUT_KEY = 'hair-expo-checkout-result';
const REORDER_DISCOUNT_KEY = 'hair-expo-reorder-expo-discount';

export default function OrderPage() {
  const { locale, t } = useI18n();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const money = (minor: number | null | undefined, currency: string) => formatMinor(minor, currency, locale);

  const loadOrder = useCallback(async (reconcile = false) => {
    try {
      setOrder(await (reconcile ? api.refreshOrder(orderId) : api.order(orderId)));
      setError('');
    } catch (cause) {
      setError(localizeError(cause, t));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);
  useEffect(() => {
    if (!order || order.paymentStatus === 'paid') return undefined;
    const timer = window.setInterval(() => void loadOrder(), 3000);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  const print = () => {
    if (!order) return;
    try {
      printInvoice(order, locale);
    } catch (cause) {
      setError(localizeError(cause, t));
    }
  };

  const createCheckoutDraftFromOrder = () => {
    if (!order) return;
    const copiedItems: CartItem[] = [];
    for (const item of order.items ?? []) {
      if (!item.productId || !item.variantId || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        setError(t('errorGeneric'));
        return;
      }
      copiedItems.push({ productId: item.productId, variantId: item.variantId, sku: item.sku, quantity: item.quantity, blonde: Boolean(item.blonde) });
    }
    if (copiedItems.length === 0) {
      setError(t('errorGeneric'));
      return;
    }
    localStorage.setItem(CART_KEY, JSON.stringify(copiedItems));
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: order.customerName ?? '', contact: order.customerContact ?? '' }));
    localStorage.setItem(REORDER_DISCOUNT_KEY, String(order.selectedDiscountReason === 'EXPO_DISCOUNT'));
    localStorage.removeItem(INTENT_KEY);
    localStorage.removeItem(CHECKOUT_KEY);
    window.location.assign('/');
  };

  const isPaid = order?.paymentStatus === 'paid';
  const canShowQr = Boolean(order?.checkoutUrl && !order.paymentLinkExpired && !order.paymentLinkDeactivatedAt && !isPaid);
  const items = order?.items ?? [];
  const hasPaymentLink = Boolean(order?.checkoutUrl);
  const paymentLabel = isPaid
    ? t('paymentConfirmed')
    : order?.paymentLinkExpired
      ? t('paymentLinkExpired')
      : t('paymentPending');

  return (
    <main className="shell order-detail-shell">
      <section className="order-detail-page">
        <header className="order-detail-header">
          <div className="order-detail-heading">
            <p className="order-detail-eyebrow">
              <a className="company-link" href="/">{COMPANY_NAME}</a>
              <span aria-hidden="true">·</span>
              <span>{t('payment')}</span>
            </p>
            <p className="muted order-detail-company-details">{COMPANY_DETAILS}</p>
          </div>
          <nav className="top-actions order-detail-actions" aria-label="Order navigation">
            <LanguageSwitcher />
            <Link className="button secondary" href="/orders">{t('viewOrders')}</Link>
            <Link className="button secondary" href="/">{t('backToCheckout')}</Link>
          </nav>
        </header>

        <div className="order-identity">
          <div>
            <span className="muted">{t('orderStatus')}</span>
            <h1>{order ? order.orderNumber : t('orderStatus')}</h1>
          </div>
          {order && <span className={`order-status-badge ${isPaid ? 'paid' : 'pending'}`}>{paymentLabel}</span>}
        </div>

        {loading && <p className="muted">{t('loadingOrderStatus')}</p>}
        {error && <p className="error">{error}</p>}

        {order && <>
          <section className="order-summary-card" aria-label={t('orderStatus')}>
            <div>
              <span className={`status-indicator ${isPaid ? 'paid' : 'pending'}`}>
                <span aria-hidden="true">●</span> {paymentLabel}
              </span>
              <p className="muted order-summary-note">
                {isPaid ? t('statusConfirmedWebhook') : canShowQr ? t('statusPolling') : t('paymentLinkExpiredHint')}
              </p>
            </div>
            <div className="order-total-block">
              <span>{t('total')}</span>
              <strong>{money(order.totalAmountMinor, order.currency)}</strong>
            </div>
          </section>

          <div className="order-detail-grid">
            <section className="order-info-card">
              <div className="order-card-heading"><h2>{t('customer')}</h2><span className="order-card-tag">{order.customerName ? t('name') : t('walkIn')}</span></div>
              <p className="order-customer-name">{order.customerName || t('walkIn')}</p>
              {order.customerContact && <p className="muted">{order.customerContact}</p>}
            </section>
            <section className="order-info-card">
              <div className="order-card-heading"><h2>{t('payment')}</h2><span className="order-card-tag">{order.currency}</span></div>
              <p className="order-payment-state">{paymentLabel}</p>
              <p className="muted">{hasPaymentLink ? t('paymentLink') : t('paymentLinkUnavailable')}</p>
            </section>
          </div>

          <section className="order-info-card order-items-card">
            <div className="order-card-heading"><h2>{t('items')}</h2><span className="order-card-tag">{items.length}</span></div>
            <div className="order-detail-item-list">
              {items.map((item, index) => <div className="order-detail-item" key={`${item.sku}-${index}`}>
                <div className="order-item-copy">
                  <strong>{item.sku}</strong>
                  <span className="muted">{item.name || item.line || item.productType || ''}</span>
                  <div className="order-item-meta">
                    <span>{item.quantity} {t('invoiceQuantity').toLowerCase()}</span>
                    {item.weightContributionGrams != null && <span>{new Intl.NumberFormat(locale).format(item.weightContributionGrams)} g</span>}
                  </div>
                </div>
                <strong>{money(item.lineTotalMinor, order.currency)}</strong>
              </div>)}
            </div>
            <div className="order-pricing">
              <div className="total-row"><span>{t('subtotal')}</span><strong>{money(order.subtotalMinor, order.currency)}</strong></div>
              {order.adjustments && order.adjustments.length > 0 && <div className="order-adjustment-list">
                {order.adjustments.map((adjustment, index) => <div className="total-row order-adjustment-row" key={`${adjustment.code}-${index}`}>
                  <span>{adjustment.label}</span>
                  <strong className={adjustment.type === 'DISCOUNT' ? 'discount-amount' : ''}>{adjustment.type === 'DISCOUNT' ? '−' : '+'}{money(adjustment.amountMinor, order.currency)}</strong>
                </div>)}
              </div>}
              <div className="total-row order-grand-total"><span>{t('total')}</span><strong>{money(order.totalAmountMinor, order.currency)}</strong></div>
            </div>
          </section>

          {canShowQr && <section className="order-payment-card qr">
            <div className="order-payment-copy">
              <span className="payment-card-kicker">{t('paymentLink')}</span>
              <h2>{t('paymentPending')}</h2>
              <p className="muted">{t('statusConfirmedWebhook')}</p>
              <div className="order-payment-actions">
                <a className="button" href={order.checkoutUrl!}>{t('openStripeCheckout')}</a>
                <button className="button secondary" onClick={() => void loadOrder(true)}>{t('refreshPaymentStatus')}</button>
                <button className="button secondary" onClick={createCheckoutDraftFromOrder}>{t('reorder')}</button>
              </div>
            </div>
            <div className="order-qr-code"><QRCodeSVG value={order.checkoutUrl!} size={220} includeMargin /></div>
          </section>}

          {!isPaid && !canShowQr && (order.paymentLinkExpired || order.paymentLinkDeactivatedAt) && <section className="order-payment-card expired">
            <div><span className="payment-card-kicker">{t('paymentLink')}</span><h2>{order.paymentLinkExpired ? t('paymentLinkExpired') : t('paymentLinkUnavailable')}</h2><p className="muted">{t('paymentLinkExpiredHint')}</p></div>
            <button className="button" onClick={createCheckoutDraftFromOrder}>{t('reorder')}</button>
          </section>}

          {isPaid && <section className="order-payment-card paid-card">
            <div><span className="payment-card-kicker">{t('paymentConfirmed')}</span><h2>{t('paymentConfirmed')}</h2><p className="muted">{t('statusConfirmedWebhook')}</p></div>
            <div className="order-payment-actions"><button className="button secondary" onClick={createCheckoutDraftFromOrder}>{t('reorder')}</button><button className="button" onClick={print}>{t('printPdf')}</button></div>
          </section>}

          {!isPaid && !order.paymentLinkExpired && !order.checkoutUrl && <section className="order-payment-card expired">
            <div><span className="payment-card-kicker">{t('paymentLink')}</span><h2>{t('paymentLinkUnavailable')}</h2></div>
            <button className="button" onClick={createCheckoutDraftFromOrder}>{t('reorder')}</button>
          </section>}
        </>}
      </section>
    </main>
  );
}
