'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../../lib/company';
import { Order } from '../../../lib/types';

function money(minor: number, symbol: string): string {
  const whole = Math.floor(minor / 100);
  return `${symbol}${whole.toLocaleString('en-US')}.${String(minor % 100).padStart(2, '0')}`;
}

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async (reconcile = false) => {
    try {
      setOrder(await (reconcile ? api.refreshOrder(orderId) : api.order(orderId)));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!order || order.paymentStatus === 'paid') return undefined;
    const timer = window.setInterval(() => void loadOrder(), 3000);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  return (
    <main className="shell auth-shell">
      <section className="panel order-status-page">
        <p className="status"><a className="company-link" href="/">{COMPANY_NAME}</a> · Payment</p>
        <p className="muted">{COMPANY_DETAILS}</p>
        <h1 className="brand">{order ? order.orderNumber : 'Order status'}</h1>
        {loading && <p className="muted">Loading order status…</p>}
        {error && <p className="error">{error}</p>}
        {order && (
          <>
            <p className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>
              {order.paymentStatus === 'paid' ? 'Payment confirmed' : 'Payment pending'}
            </p>
            <p className="total-row">
              <span>Total</span>
              <strong>{money(order.totalAmountMinor, order.currency === 'CNY' ? '¥' : '$')}</strong>
            </p>
            {order.paymentStatus !== 'paid' && <p className="muted">This page checks the backend every few seconds for the Stripe webhook update.</p>}
            <button className="button secondary" onClick={() => void loadOrder(true)}>Refresh status</button>
          </>
        )}
      </section>
    </main>
  );
}
