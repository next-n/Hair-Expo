'use client';

import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { COMPANY_NAME, GUIDE_URL } from '../lib/company';
import { printInvoice } from '../lib/invoice';
import { formatDate, formatMinor, LanguageSwitcher, localizeError, useI18n } from '../lib/i18n';
import { CartItem, CheckoutResponse, Order, PricePreview, Product } from '../lib/types';

const CART_KEY = 'hair-expo-cart';
const INTENT_KEY = 'hair-expo-checkout-intent';
const CUSTOMER_KEY = 'hair-expo-customer';
const CHECKOUT_KEY = 'hair-expo-checkout-result';

type StoredCheckout = { requestKey: string; response: CheckoutResponse };
type StoredIntent = { key: string; requestKey: string };

function mergeCartItems(items: readonly CartItem[]): CartItem[] {
  const merged: CartItem[] = [];
  for (const item of items) {
    const index = merged.findIndex((existing) => existing.productId === item.productId && existing.variantId === item.variantId && Boolean(existing.blonde) === Boolean(item.blonde));
    if (index === -1) {
      merged.push({ ...item });
      continue;
    }
    const existing = merged[index];
    const quantity = existing.quantity + item.quantity;
    merged[index] = { ...existing, quantity: Number.isSafeInteger(quantity) ? quantity : Number.MAX_SAFE_INTEGER };
  }
  return merged;
}

function productSearchRank(product: Product, query: string): number | null {
  if (!query) return 0;
  const fields = [product.sku, product.line, product.productType, product.lengthIn ?? ''].map((field) => field.toLowerCase());
  if (!fields.some((field) => field.includes(query))) return null;
  if (fields[0] === query) return 0;
  if (fields[0].startsWith(query)) return 1;
  if (fields[1].startsWith(query)) return 2;
  if (fields[2].startsWith(query)) return 3;
  if (fields[3].startsWith(query)) return 4;
  if (fields[0].includes(query)) return 5;
  if (fields[1].includes(query)) return 6;
  if (fields[2].includes(query)) return 7;
  return 8;
}

export default function HomePage() {
  const { locale, t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [checkoutRequestKey, setCheckoutRequestKey] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [expoDiscountEnabled, setExpoDiscountEnabled] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [blonde, setBlonde] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showOrders, setShowOrders] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid'>('paid');
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const visibleProducts = useMemo(() => products.map((product, index) => ({ product, index, rank: productSearchRank(product, search.trim().toLowerCase()) })).filter((result): result is { product: Product; index: number; rank: number } => result.rank !== null).sort((left, right) => left.rank - right.rank || left.index - right.index).map((result) => result.product), [products, search]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const linePreview = (index: number) => preview?.lines[index];
  const visibleOrders = useMemo(() => orderFilter === 'paid' ? orders.filter((order) => order.paymentStatus === 'paid') : orders, [orderFilter, orders]);
  const currentRequestKey = useMemo(() => JSON.stringify({
    currency: 'USD', customerName, customerContact, expoDiscountEnabled,
    items: cart.map(({ productId, variantId, quantity: itemQuantity, blonde: itemBlonde }) => ({ productId, variantId, quantity: itemQuantity, blonde: itemBlonde })),
  }), [cart, customerName, customerContact, expoDiscountEnabled]);
  const checkoutLocked = Boolean(checkout?.checkoutUrl);
  const money = (minor: number | null | undefined, currency: string) => formatMinor(minor, currency, locale);
  const paymentStatusLabel = (status: string | undefined) => status === 'paid' ? t('paid') : status === 'review_required' ? t('reviewRequired') : t('pending');

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const savedCart = localStorage.getItem(CART_KEY); if (savedCart) setCart(mergeCartItems(JSON.parse(savedCart) as CartItem[]));
    const savedCustomer = localStorage.getItem(CUSTOMER_KEY); if (savedCustomer) { const value = JSON.parse(savedCustomer) as { name: string; contact: string }; setCustomerName(value.name); setCustomerContact(value.contact); }
    const savedCheckout = localStorage.getItem(CHECKOUT_KEY);
    if (savedCheckout) {
      try {
        const stored = JSON.parse(savedCheckout) as StoredCheckout;
        setCheckout(stored.response); setCheckoutRequestKey(stored.requestKey);
      } catch { localStorage.removeItem(CHECKOUT_KEY); }
    }
    api.authSession().then(async (session) => {
      setUnlocked(session.authorized);
      if (session.authorized) { await api.session(); setProducts(await api.products()); }
    }).catch((e: Error) => { setUnlocked(false); setError(localizeError(e, t)); }).finally(() => setAuthReady(true));
    setHydrated(true);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: customerName, contact: customerContact })); }, [customerName, customerContact, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (checkout && checkoutRequestKey && checkoutRequestKey !== currentRequestKey) {
      setCheckout(null); setCheckoutRequestKey(null); localStorage.removeItem(CHECKOUT_KEY); localStorage.removeItem(INTENT_KEY);
    }
  }, [checkout, checkoutRequestKey, currentRequestKey, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (checkout && checkoutRequestKey === currentRequestKey) localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ requestKey: checkoutRequestKey, response: checkout } satisfies StoredCheckout));
    else if (!checkout) localStorage.removeItem(CHECKOUT_KEY);
    if (checkout?.paymentStatus === 'paid') localStorage.removeItem(INTENT_KEY);
  }, [checkout, checkoutRequestKey, currentRequestKey, hydrated]);
  useEffect(() => {
    if (!checkout?.orderId || checkout.paymentStatus === 'paid') return undefined;
    let active = true;
    const poll = async () => {
      try {
        const order = await api.order(checkout.orderId!);
        if (active && order.paymentStatus !== checkout.paymentStatus) setCheckout((current) => current ? { ...current, paymentStatus: order.paymentStatus } : current);
      } catch { /* webhook remains authoritative */ }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [checkout?.orderId, checkout?.paymentStatus]);

  const unlock = async () => { setBusy(true); setError(''); try { await api.unlock(passcode); setUnlocked(true); await api.session(); setProducts(await api.products()); } catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); } };
  const add = (product = visibleProducts[0], isBlonde = blonde) => {
    if (checkoutLocked || !product || product.variants.length === 0) return;
    const variant = product.variants[0];
    setCart((current) => mergeCartItems([...current, { productId: product.id, variantId: variant.id, sku: product.sku, quantity, blonde: isBlonde }]));
    setPreview(null); setCheckout(null); setBlonde(false); setQuantity(1);
  };
  const remove = (index: number) => { if (checkoutLocked) return; setCart((current) => current.filter((_, itemIndex) => itemIndex !== index)); setQuantityDrafts({}); setPreview(null); setCheckout(null); };
  const updateQuantity = (index: number, next: number) => {
    if (checkoutLocked) return;
    const safeQuantity = Number.isSafeInteger(next) ? Math.max(1, next) : 1;
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: safeQuantity } : item));
    setQuantityDrafts((current) => { if (!(index in current)) return current; const nextDrafts = { ...current }; delete nextDrafts[index]; return nextDrafts; });
    setPreview(null);
  };
  const editQuantity = (index: number, value: string) => {
    if (checkoutLocked || !/^\d*$/.test(value)) return;
    setQuantityDrafts((current) => ({ ...current, [index]: value }));
    if (value !== '') {
      const next = Number(value);
      if (Number.isSafeInteger(next) && next >= 1) updateQuantity(index, next);
    }
  };
  const commitQuantity = (index: number) => {
    const value = quantityDrafts[index];
    if (value === undefined) return;
    updateQuantity(index, Number(value));
  };
  const previewCart = async () => { setBusy(true); setError(''); try { setPreview(await api.preview('USD', cart, expoDiscountEnabled)); } catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); } };
  const refreshCheckoutStatus = async () => {
    if (!checkout?.orderId) return;
    setBusy(true); setError('');
    try { const order = await api.refreshOrder(checkout.orderId); setCheckout((current) => current ? { ...current, paymentStatus: order.paymentStatus } : current); }
    catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); }
  };
  const checkoutNow = async () => {
    if (checkout?.paymentStatus === 'paid') return;
    setBusy(true); setError('');
    try {
      if (checkout?.orderId) {
        const currentOrder = await api.order(checkout.orderId);
        if (currentOrder.paymentStatus === 'paid') { setCheckout((current) => current ? { ...current, paymentStatus: 'paid' } : current); return; }
      }
      let key: string | undefined;
      const savedIntent = localStorage.getItem(INTENT_KEY);
      if (savedIntent) {
        try { const stored = JSON.parse(savedIntent) as StoredIntent; if (stored.requestKey === currentRequestKey) key = stored.key; }
        catch { if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedIntent)) key = savedIntent; }
      }
      if (!key) { key = crypto.randomUUID(); localStorage.setItem(INTENT_KEY, JSON.stringify({ key, requestKey: currentRequestKey } satisfies StoredIntent)); }
      const intake = await api.intake(key, 'USD', cart, customerName, customerContact, expoDiscountEnabled);
      const result = await api.process(intake.operation.id);
      setCheckoutRequestKey(currentRequestKey); setCheckout(result); setPreview(null);
    } catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); }
  };
  const loadOrders = async () => { setShowOrders(true); setBusy(true); setError(''); try { setOrders(await api.orders()); } catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); } };
  const printOrder = async (orderId: string) => { setBusy(true); setError(''); try { printInvoice(await api.order(orderId), locale); } catch (e) { setError(localizeError(e, t)); } finally { setBusy(false); } };
  const newOrder = () => { setCart([]); setQuantityDrafts({}); setPreview(null); setCheckout(null); setCheckoutRequestKey(null); setError(''); localStorage.removeItem(INTENT_KEY); localStorage.removeItem(CHECKOUT_KEY); };
  const scrollToPayment = () => { document.querySelector<HTMLElement>('.sticky')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  if (!authReady) return <main className="shell auth-shell"><section className="panel"><LanguageSwitcher /><p className="status">{COMPANY_NAME} · {t('boothCheckout')}</p><p className="muted">{t('checkingSession')}</p></section></main>;
  if (!unlocked) return <main className="shell auth-shell"><section className="panel"><LanguageSwitcher /><p className="status">{COMPANY_NAME} · {t('boothCheckout')}</p><h1 className="brand">{t('enterPasscode')}</h1><p className="muted">{t('expoTeamOnly')}</p><label>{t('passcode')}<input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label><button className="button" disabled={busy || !passcode} onClick={unlock}>{t('unlock')}</button>{error && <p className="error">{error}</p>}</section></main>;

  return <main className="shell">
    <header className="topbar"><div><p className="status">{COMPANY_NAME} · {t('boothCheckout')}</p><h1 className="brand">{t('buildOrder')}</h1></div><div className="top-actions"><span className={online ? 'online' : 'offline'}>{online ? `● ${t('online')}` : `○ ${t('offlineCartSaved')}`}</span><LanguageSwitcher /><Link className="button secondary" href="/orders">{t('orders')}</Link></div></header>
    <div className="mobile-cart-jump"><button className="button secondary" onClick={newOrder}>{t('newOrder')}</button><button className="button secondary" onClick={scrollToPayment}>{t('cartJump')} <span aria-hidden="true">↓</span></button></div>
    <div className="grid">
      <section className="panel"><div className="product-row"><div><h2>{t('catalog')}</h2><p className="muted">{t('catalogHint')}</p></div><span className="status">{t('productsCount', { count: visibleProducts.length })}</span></div><input aria-label={t('searchCatalog')} placeholder={t('searchCatalog')} value={search} onChange={(event) => setSearch(event.target.value)} /><div className="products catalog-results">{visibleProducts.map((product) => <article className="product" key={product.id}><div className="product-row"><div><strong>{product.sku}</strong><div className="muted">{product.line} · {product.productType} · {product.lengthIn ? `${product.lengthIn} in` : t('standard')}</div></div><strong>{money(product.priceUsdMinor, 'USD')}</strong></div><div className="product-row"><span className="muted">{product.unit} · {product.packWeightGrams ? `${new Intl.NumberFormat(locale).format(product.packWeightGrams)} g` : t('weightNotSupplied')}</span><button className="button" disabled={checkoutLocked} onClick={() => add(product, false)}>{t('addNormal')}</button></div><button className="button secondary" disabled={checkoutLocked} onClick={() => add(product, true)}>{t('addBlonde')}</button></article>)}</div></section>
      <aside className="panel sticky"><div className="product-row"><div><h2>{t('cart', { count: cartCount })}</h2><p className="muted">{t('backendAuthoritative')}</p></div><button className="button secondary" onClick={newOrder}>{t('newOrder')}</button></div>{checkoutLocked && <p className="muted">{t('paymentLinkCreated')}</p>}<div className="cart">{cart.length === 0 ? <p className="muted">{t('addProduct')}</p> : cart.map((item, index) => <div className="cart-row" key={`${item.sku}-${index}`}><div><strong>{item.sku}</strong><div className="muted">{item.blonde ? t('blonde') : t('normal')}{linePreview(index) ? ` · ${money(linePreview(index)?.lineTotalMinor, 'USD')}` : ''}</div></div><div className="stepper"><button className="button secondary" disabled={checkoutLocked} onClick={() => updateQuantity(index, item.quantity - 1)}>−</button><input className="quantity-input" aria-label={`${t('invoiceQuantity')} ${item.sku}`} type="number" inputMode="numeric" min={1} step={1} disabled={checkoutLocked} value={quantityDrafts[index] ?? item.quantity} onChange={(event) => editQuantity(index, event.target.value)} onBlur={() => commitQuantity(index)} /><button className="button secondary" disabled={checkoutLocked} onClick={() => updateQuantity(index, item.quantity + 1)}>+</button><button className="button secondary" disabled={checkoutLocked} onClick={() => remove(index)}>{t('remove')}</button></div></div>)}</div><label className="toggle"><input type="checkbox" disabled={checkoutLocked} checked={expoDiscountEnabled} onChange={(event) => { setExpoDiscountEnabled(event.target.checked); setPreview(null); }} /> {t('expoDiscount')}</label><div className="customer"><h3>{t('customer')}</h3><label>{t('name')}<input disabled={checkoutLocked} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t('optional')} /></label><label>{t('phoneContact')}<input disabled={checkoutLocked} value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} placeholder={t('optional')} /></label></div>{error && <p className="error">{error}</p>}{preview && <div className="success"><div className="total-row"><span>{t('weight')}</span><strong>{new Intl.NumberFormat(locale).format(preview.totalWeightGrams)} g</strong></div><div className="total-row"><span>{t('subtotal')}</span><strong>{money(preview.subtotalMinor, 'USD')}</strong></div><div className="total-row"><span>{preview.selectedDiscountReason === 'VOLUME_DISCOUNT' ? t('volumeDiscount') : preview.selectedDiscountReason === 'EXPO_DISCOUNT' ? t('expoDiscount') : t('discount')}</span><strong>−{money(preview.discountMinor, 'USD')}</strong></div><div className="total-row total"><span>{t('usdTotal')}</span><strong>{money(preview.totalMinor, 'USD')}</strong></div><div className="total-row"><span>{t('cnyReference')}</span><strong>{money(preview.totalCnyMinor, 'CNY')}</strong></div></div>}<div className="actions"><button className="button secondary" disabled={!cart.length || busy || !online || checkoutLocked} onClick={previewCart}>{t('previewBackendPrice')}</button><button className="button" disabled={!cart.length || busy || !online || checkoutLocked} onClick={checkoutNow}>{busy ? t('creating') : checkout?.paymentStatus === 'paid' ? t('paidStartNewOrder') : checkout?.status === 'review_required' ? t('retryPaymentLink') : t('createPaymentLink')}</button></div><div className="checkout-guide-card"><span className="checkout-guide-icon" aria-hidden="true">?</span><div><strong>{t('projectGuide')}</strong><span>{t('projectGuideHint')}</span></div><a className="button secondary" href={GUIDE_URL}>{t('openGuide')}</a></div>{checkout?.checkoutUrl && <div className="qr"><strong>{checkout.orderNumber} · {paymentStatusLabel(checkout.paymentStatus)}</strong><QRCodeSVG value={checkout.checkoutUrl} size={220} includeMargin /><a href={checkout.checkoutUrl} target="_blank" rel="noreferrer">{t('openStripeCheckout')}</a>{checkout.paymentStatus !== 'paid' && <button className="button secondary" disabled={busy} onClick={refreshCheckoutStatus}>{t('refreshPaymentStatus')}</button>}{checkout.paymentStatus === 'paid' && <button className="button secondary" disabled={busy} onClick={() => void printOrder(checkout.orderId!)}>{t('printPdf')}</button>}<span className="muted">{t('statusConfirmedWebhook')}</span></div>}</aside>
    </div>
    {showOrders && <section className="panel orders-panel"><div className="product-row"><div><h2>{t('orders')}</h2><p className="muted">{t('paidOrdersDefault')}</p></div><div className="top-actions"><select aria-label={t('orders')} value={orderFilter} onChange={(event) => setOrderFilter(event.target.value as 'all' | 'paid')}><option value="paid">{t('paidOnly')}</option><option value="all">{t('allOrders')}</option></select><button className="button secondary" onClick={() => void loadOrders()}>{t('reload')}</button><button className="button secondary" onClick={() => setShowOrders(false)}>{t('close')}</button></div></div>{busy && <p className="muted">{t('loadingOrders')}</p>}{error && <p className="error">{error}</p>}{!busy && visibleOrders.length === 0 ? <p className="muted">{t('noMatchingOrders')}</p> : <div className="orders">{visibleOrders.map((order) => <div className="order-row" key={order.id}><div><strong>{order.orderNumber}</strong><div className="muted">{order.customerName || t('walkIn')} · {formatDate(order.createdAt, locale)}</div></div><div><strong>{money(order.totalAmountMinor, order.currency)}</strong><span className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{paymentStatusLabel(order.paymentStatus)}</span><button className="button secondary" onClick={async () => { try { const refreshed = await api.refreshOrder(order.id); setOrders((current) => current.map((item) => item.id === order.id ? refreshed : item)); } catch (e) { setError(localizeError(e, t)); } }}>{t('refreshStatus')}</button><button className="button secondary" disabled={order.paymentStatus !== 'paid' || busy} onClick={() => void printOrder(order.id)}>{t('printPdf')}</button></div></div>)}</div>}</section>}
  </main>;
}
