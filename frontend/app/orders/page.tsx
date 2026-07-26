'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../lib/company';
import { formatDate, formatMinor, LanguageSwitcher, localizeError, useI18n } from '../../lib/i18n';
import { printInvoice } from '../../lib/invoice';
import { Order } from '../../lib/types';

export default function OrdersPage() {
  const { locale, t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'paid' | 'all'>('paid');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const money = (minor: number, currency: string) => formatMinor(minor, currency, locale);
  const paymentStatusLabel = (status: string) => status === 'paid' ? t('paid') : status === 'review_required' ? t('reviewRequired') : t('pending');

  const loadOrders = useCallback(async () => {
    setBusy(true); setError('');
    try { setOrders(await api.orders()); }
    catch (cause) { setError(localizeError(cause, t)); }
    finally { setBusy(false); }
  }, [t]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const visibleOrders = useMemo(() => filter === 'paid' ? orders.filter((order) => order.paymentStatus === 'paid') : orders, [filter, orders]);
  const paidTotal = useMemo(() => orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.totalAmountMinor, 0), [orders]);

  const refresh = async (orderId: string) => {
    setBusy(true); setError('');
    try { const order = await api.refreshOrder(orderId); setOrders((current) => current.map((item) => item.id === orderId ? order : item)); }
    catch (cause) { setError(localizeError(cause, t)); }
    finally { setBusy(false); }
  };

  const printOrder = async (orderId: string) => {
    setBusy(true); setError('');
    try { printInvoice(await api.order(orderId), locale); }
    catch (cause) { setError(localizeError(cause, t)); }
    finally { setBusy(false); }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="status"><a className="company-link" href="/">{COMPANY_NAME}</a> · {t('boothCheckout')}</p><p className="muted">{COMPANY_DETAILS}</p><h1 className="brand">{t('orders')}</h1></div>
        <div className="top-actions"><LanguageSwitcher /><a className="button secondary" href="/">{t('backToCheckout')}</a><button className="button secondary" disabled={busy} onClick={() => void loadOrders()}>{t('reload')}</button></div>
      </header>
      <section className="panel orders-panel">
        <div className="product-row"><div><h2>{t('soldOrders')}</h2><p className="muted">{t('paidTotal', { amount: money(paidTotal, 'USD') })}</p></div><select aria-label={t('orders')} value={filter} onChange={(event) => setFilter(event.target.value as 'paid' | 'all')}><option value="paid">{t('paidOnly')}</option><option value="all">{t('allOrders')}</option></select></div>
        {busy && <p className="muted">{t('loadingOrders')}</p>}
        {error && <p className="error">{error}</p>}
        {!busy && !error && visibleOrders.length === 0 && <p className="muted">{t('noMatchingOrders')}</p>}
        {!error && <div className="orders">{visibleOrders.map((order) => <div className="order-row" key={order.id}><div><strong>{order.orderNumber}</strong><div className="muted">{order.customerName || t('walkIn')} · {formatDate(order.createdAt, locale)}</div></div><div><strong>{money(order.totalAmountMinor, order.currency)}</strong><span className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{paymentStatusLabel(order.paymentStatus)}</span><button className="button secondary" disabled={busy} onClick={() => void refresh(order.id)}>{t('refreshStatus')}</button><button className="button secondary" disabled={order.paymentStatus !== 'paid' || busy} onClick={() => void printOrder(order.id)}>{t('printPdf')}</button></div></div>)}</div>}
      </section>
    </main>
  );
}
