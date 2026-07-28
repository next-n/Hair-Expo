'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../lib/company';
import { formatDate, formatMinor, LanguageSwitcher, localizeError, useI18n } from '../../lib/i18n';
import { printInvoice } from '../../lib/invoice';
import { Order } from '../../lib/types';

type StatusFilter = 'paid' | 'pending' | 'all';

function localDateBoundary(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + (endOfDay ? 1 : 0), 0, 0, 0, 0);
  return date.toISOString();
}

export default function OrdersPage() {
  const { locale, t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const money = (minor: number, currency: string) => formatMinor(minor, currency, locale);
  const paymentStatusLabel = (status: string) => status === 'paid' ? t('paid') : t('pending');

  const loadOrders = useCallback(async () => {
    setBusy(true); setError('');
    try {
      if (fromDate && toDate && fromDate > toDate) throw new Error('The order date range is invalid');
      setOrders(await api.orders({ status: filter, from: localDateBoundary(fromDate), to: localDateBoundary(toDate, true) }));
    } catch (cause) { setError(localizeError(cause, t)); }
    finally { setBusy(false); }
  }, [filter, fromDate, toDate, t]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase(locale);
    if (!query) return orders;
    return orders.filter((order) => (order.customerName ?? '').toLocaleLowerCase(locale).includes(query));
  }, [customerSearch, locale, orders]);
  const paidTotal = useMemo(() => visibleOrders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.totalAmountMinor, 0), [visibleOrders]);

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

  const openOrder = (orderId: string) => {
    setOpeningOrderId(orderId);
    window.setTimeout(() => window.location.assign(`/orders/${orderId}`), 120);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="status"><a className="company-link" href="/">{COMPANY_NAME}</a> · {t('boothCheckout')}</p><p className="muted">{COMPANY_DETAILS}</p><h1 className="brand">{t('orders')}</h1></div>
        <div className="top-actions"><LanguageSwitcher /><a className="button secondary" href="/">{t('backToCheckout')}</a><button className="button secondary" disabled={busy} onClick={() => void loadOrders()}>{t('reload')}</button></div>
      </header>
      <section className="panel orders-panel">
        <div className="product-row"><div><h2>{t('soldOrders')}</h2><p className="muted">{t('paidTotal', { amount: money(paidTotal, 'USD') })}</p></div></div>
        <div className="order-filters">
          <label>{t('status')}<select aria-label={t('status')} value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}><option value="all">{t('allOrders')}</option><option value="paid">{t('paidOnly')}</option><option value="pending">{t('pendingOnly')}</option></select></label>
          <label>{t('fromDate')}<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>{t('toDate')}<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="order-search">{t('searchCustomer')}<input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder={t('searchCustomer')} /></label>
          {(fromDate || toDate) && <button className="button secondary" onClick={() => { setFromDate(''); setToDate(''); }}>{t('clearDates')}</button>}
        </div>
        {busy && <p className="muted">{t('loadingOrders')}</p>}
        {error && <p className="error">{error}</p>}
        {!busy && !error && visibleOrders.length === 0 && <p className="muted">{t('noMatchingOrders')}</p>}
        {!error && <div className="orders">{visibleOrders.map((order) => <div className="order-row" key={order.id}><div><button className="order-number order-number-button" disabled={openingOrderId !== null} onClick={() => openOrder(order.id)}><strong>{order.orderNumber}</strong></button><div className="muted">{order.customerName || t('walkIn')} · {formatDate(order.createdAt, locale)}</div></div><div><strong>{money(order.totalAmountMinor, order.currency)}</strong><span className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{paymentStatusLabel(order.paymentStatus)}</span><button className="button secondary" disabled={openingOrderId !== null} onClick={() => openOrder(order.id)}>{openingOrderId === order.id && <span className="loading-spinner" aria-hidden="true" />}{openingOrderId === order.id ? t('loadingOrderStatus') : t('viewOrder')}</button><button className="button secondary" disabled={busy} onClick={() => void refresh(order.id)}>{t('refreshStatus')}</button><button className="button secondary" disabled={order.paymentStatus !== 'paid' || busy} onClick={() => void printOrder(order.id)}>{t('printPdf')}</button></div></div>)}</div>}
      </section>
    </main>
  );
}
