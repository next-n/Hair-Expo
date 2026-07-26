'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { COMPANY_DETAILS, COMPANY_NAME } from '../../../lib/company';
import { formatMinor, LanguageSwitcher, localizeError, useI18n } from '../../../lib/i18n';
import { Order } from '../../../lib/types';

export default function OrderPage() {
  const { locale, t } = useI18n();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const money = (minor: number, currency: string) => formatMinor(minor, currency, locale);

  const loadOrder = useCallback(async (reconcile = false) => {
    try { setOrder(await (reconcile ? api.refreshOrder(orderId) : api.order(orderId))); setError(''); }
    catch (cause) { setError(localizeError(cause, t)); }
    finally { setLoading(false); }
  }, [orderId, t]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);
  useEffect(() => {
    if (!order || order.paymentStatus === 'paid') return undefined;
    const timer = window.setInterval(() => void loadOrder(), 3000);
    return () => window.clearInterval(timer);
  }, [loadOrder, order]);

  return (
    <main className="shell auth-shell">
      <section className="panel order-status-page">
        <div className="top-actions"><LanguageSwitcher /></div>
        <p className="status"><a className="company-link" href="/">{COMPANY_NAME}</a> · {t('payment')}</p>
        <p className="muted">{COMPANY_DETAILS}</p>
        <h1 className="brand">{order ? order.orderNumber : t('orderStatus')}</h1>
        {loading && <p className="muted">{t('loadingOrderStatus')}</p>}
        {error && <p className="error">{error}</p>}
        {order && <>
          <p className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{order.paymentStatus === 'paid' ? t('paymentConfirmed') : t('paymentPending')}</p>
          <p className="total-row"><span>{t('total')}</span><strong>{money(order.totalAmountMinor, order.currency)}</strong></p>
          {order.paymentStatus !== 'paid' && <p className="muted">{t('statusPolling')}</p>}
          <button className="button secondary" onClick={() => void loadOrder(true)}>{t('refreshStatus')}</button>
        </>}
      </section>
    </main>
  );
}
