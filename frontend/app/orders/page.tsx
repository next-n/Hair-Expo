'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../lib/company';
import { printInvoice } from '../../lib/invoice';
import { Order } from '../../lib/types';

function money(minor: number, currency: string): string {
  return `${currency.toUpperCase() === 'CNY' ? '¥' : '$'}${(minor / 100).toFixed(2)}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'paid' | 'all'>('paid');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setOrders(await api.orders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load orders.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const visibleOrders = useMemo(() => filter === 'paid' ? orders.filter((order) => order.paymentStatus === 'paid') : orders, [filter, orders]);
  const paidTotal = useMemo(() => orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.totalAmountMinor, 0), [orders]);

  const refresh = async (orderId: string) => {
    setBusy(true);
    try {
      const order = await api.refreshOrder(orderId);
      setOrders((current) => current.map((item) => item.id === orderId ? order : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to refresh order.');
    } finally {
      setBusy(false);
    }
  };

  const printOrder = async (orderId: string) => {
    setBusy(true);
    setError('');
    try {
      printInvoice(await api.order(orderId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to print invoice.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="status"><a className="company-link" href="/">{COMPANY_NAME}</a> · Booth checkout</p><p className="muted">{COMPANY_DETAILS}</p><h1 className="brand">Orders</h1></div>
        <div className="top-actions"><a className="button secondary" href="/">Back to checkout</a><button className="button secondary" disabled={busy} onClick={() => void loadOrders()}>Reload</button></div>
      </header>
      <section className="panel orders-panel">
        <div className="product-row"><div><h2>Sold orders</h2><p className="muted">Paid total: {money(paidTotal, 'USD')}</p></div><select aria-label="Order filter" value={filter} onChange={(event) => setFilter(event.target.value as 'paid' | 'all')}><option value="paid">Paid only</option><option value="all">All orders</option></select></div>
        {busy && <p className="muted">Loading orders…</p>}
        {error && <p className="error">{error} — unlock from the checkout page if your booth session expired.</p>}
        {!busy && !error && visibleOrders.length === 0 && <p className="muted">No matching orders.</p>}
        {!error && <div className="orders">{visibleOrders.map((order) => <div className="order-row" key={order.id}><div><strong>{order.orderNumber}</strong><div className="muted">{order.customerName || 'Walk-in'} · {new Date(order.createdAt).toLocaleString()}</div></div><div><strong>{money(order.totalAmountMinor, order.currency)}</strong><span className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{order.paymentStatus}</span><button className="button secondary" disabled={busy} onClick={() => void refresh(order.id)}>Refresh status</button><button className="button secondary" disabled={order.paymentStatus !== 'paid' || busy} onClick={() => void printOrder(order.id)}>Print / PDF</button></div></div>)}</div>}
      </section>
    </main>
  );
}
