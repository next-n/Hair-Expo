'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { CartItem, CheckoutResponse, Order, PricePreview, Product } from '../lib/types';

const CART_KEY = 'hair-expo-cart';
const INTENT_KEY = 'hair-expo-checkout-intent';
const CUSTOMER_KEY = 'hair-expo-customer';

function money(minor: number | null | undefined, symbol: string): string {
  if (minor === null || minor === undefined) return '—';
  const whole = Math.floor(minor / 100);
  return `${symbol}${whole.toLocaleString('en-US')}.${String(minor % 100).padStart(2, '0')}`;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [expoDiscountEnabled, setExpoDiscountEnabled] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [blonde, setBlonde] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [unlocked, setUnlocked] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [showOrders, setShowOrders] = useState(false);

  const visibleProducts = useMemo(() => products.filter((product) => !search || `${product.sku} ${product.line} ${product.productType} ${product.lengthIn ?? ''}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const selected = visibleProducts[0];
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const linePreview = (index: number) => preview?.lines[index];

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const savedCart = localStorage.getItem(CART_KEY); if (savedCart) setCart(JSON.parse(savedCart) as CartItem[]);
    const savedCustomer = localStorage.getItem(CUSTOMER_KEY); if (savedCustomer) { const value = JSON.parse(savedCustomer) as { name: string; contact: string }; setCustomerName(value.name); setCustomerContact(value.contact); }
    api.authSession().then((session) => { setUnlocked(!session.required); if (!session.required) return api.session().then(() => api.products()).then(setProducts); return undefined; }).catch((e: Error) => setError(e.message));
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: customerName, contact: customerContact })); }, [customerName, customerContact]);

  const unlock = async () => { setBusy(true); setError(''); try { await api.unlock(passcode); setUnlocked(true); await api.session(); setProducts(await api.products()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const add = (product = selected, isBlonde = blonde) => {
    if (!product || product.variants.length === 0) return;
    const variant = product.variants[0];
    setCart((current) => [...current, { productId: product.id, variantId: variant.id, sku: product.sku, quantity, blonde: isBlonde }]);
    setPreview(null); setCheckout(null); setBlonde(false); setQuantity(1);
  };
  const remove = (index: number) => { setCart((current) => current.filter((_, itemIndex) => itemIndex !== index)); setPreview(null); setCheckout(null); };
  const updateQuantity = (index: number, next: number) => { setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Math.min(100, next)) } : item)); setPreview(null); };
  const previewCart = async () => { setBusy(true); setError(''); try { setPreview(await api.preview('USD', cart, expoDiscountEnabled)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const checkoutNow = async () => {
    setBusy(true); setError('');
    try {
      let key = localStorage.getItem(INTENT_KEY); if (!key) { key = crypto.randomUUID(); localStorage.setItem(INTENT_KEY, key); }
      const intake = await api.intake(key, 'USD', cart, customerName, customerContact, expoDiscountEnabled);
      setCheckout(await api.process(intake.operation.id));
      setPreview(null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const loadOrders = async () => { setBusy(true); try { setOrders(await api.orders()); setShowOrders(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const newOrder = () => { setCart([]); setPreview(null); setCheckout(null); setError(''); localStorage.removeItem(INTENT_KEY); };

  if (!unlocked) return <main className="shell auth-shell"><section className="panel"><p className="status">TRUNOV HAIR · Booth checkout</p><h1 className="brand">Enter booth passcode</h1><p className="muted">This tool is for the expo team.</p><label>Passcode<input type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label><button className="button" disabled={busy || !passcode} onClick={unlock}>Unlock</button>{error && <p className="error">{error}</p>}</section></main>;

  return <main className="shell">
    <header className="topbar"><div><p className="status">TRUNOV HAIR · Booth checkout</p><h1 className="brand">Build an order in seconds</h1></div><div className="top-actions"><span className={online ? 'online' : 'offline'}>{online ? '● Online' : '○ Offline — cart saved'}</span><button className="button secondary" onClick={loadOrders}>Orders</button></div></header>
    <div className="grid">
      <section className="panel"><div className="product-row"><div><h2>Catalog</h2><p className="muted">Search by SKU, line, product type, or length.</p></div><span className="status">{visibleProducts.length} products</span></div><input aria-label="Search catalog" placeholder="Search SKU or product…" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="products catalog-results">{visibleProducts.map((product) => <article className="product" key={product.id}><div className="product-row"><div><strong>{product.sku}</strong><div className="muted">{product.line} · {product.productType} · {product.lengthIn ? `${product.lengthIn} in` : 'standard'}</div></div><strong>{money(product.priceUsdMinor, '$')}</strong></div><div className="product-row"><span className="muted">{product.unit} · {product.packWeightGrams ? `${product.packWeightGrams} g` : 'weight not supplied'}</span><button className="button" onClick={() => add(product, false)}>Add normal</button></div><button className="button secondary" onClick={() => add(product, true)}>Add blonde +30%</button></article>)}</div></section>
      <aside className="panel sticky"><div className="product-row"><div><h2>Cart ({cartCount})</h2><p className="muted">Backend prices are authoritative.</p></div><button className="button secondary" onClick={newOrder}>New order</button></div><div className="cart">{cart.length === 0 ? <p className="muted">Add a product to begin.</p> : cart.map((item, index) => <div className="cart-row" key={`${item.sku}-${index}`}><div><strong>{item.sku}</strong><div className="muted">{item.blonde ? 'Blonde +30%' : 'Normal'}{linePreview(index) ? ` · ${money(linePreview(index)?.lineTotalMinor, '$')}` : ''}</div></div><div className="stepper"><button className="button secondary" onClick={() => updateQuantity(index, item.quantity - 1)}>−</button><span>{item.quantity}</span><button className="button secondary" onClick={() => updateQuantity(index, item.quantity + 1)}>+</button><button className="button secondary" onClick={() => remove(index)}>Remove</button></div></div>)}</div><label className="toggle"><input type="checkbox" checked={expoDiscountEnabled} onChange={(event) => { setExpoDiscountEnabled(event.target.checked); setPreview(null); }} /> Expo discount (10%)</label><div className="customer"><h3>Customer</h3><label>Name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Optional" /></label><label>Phone / WeChat / email<input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} placeholder="Optional" /></label></div>{error && <p className="error">{error}</p>}{preview && <div className="success"><div className="total-row"><span>Weight</span><strong>{preview.totalWeightGrams.toLocaleString()} g</strong></div><div className="total-row"><span>Subtotal</span><strong>{money(preview.subtotalMinor, '$')}</strong></div><div className="total-row"><span>{preview.selectedDiscountReason ? preview.selectedDiscountReason.replace('_', ' ') : 'Discount'}</span><strong>−{money(preview.discountMinor, '$')}</strong></div><div className="total-row total"><span>USD total</span><strong>{money(preview.totalMinor, '$')}</strong></div><div className="total-row"><span>CNY reference</span><strong>{money(preview.totalCnyMinor, '¥')}</strong></div></div>}<div className="actions"><button className="button secondary" disabled={!cart.length || busy || !online} onClick={previewCart}>Preview backend price</button><button className="button" disabled={!cart.length || busy || !online} onClick={checkoutNow}>{busy ? 'Creating…' : checkout?.status === 'review_required' ? 'Retry payment link' : 'Create Payment Link'}</button></div>{checkout?.checkoutUrl && <div className="qr"><strong>{checkout.orderNumber} · {checkout.paymentStatus ?? 'pending'}</strong><QRCodeSVG value={checkout.checkoutUrl} size={220} includeMargin /><a href={checkout.checkoutUrl} target="_blank" rel="noreferrer">Open Stripe Checkout</a><span className="muted">Status is confirmed by the backend webhook.</span></div>}</aside>
    </div>
    {showOrders && <section className="panel orders-panel"><div className="product-row"><h2>Orders</h2><button className="button secondary" onClick={() => setShowOrders(false)}>Close</button></div>{orders.length === 0 ? <p className="muted">No orders yet.</p> : <div className="orders">{orders.map((order) => <div className="order-row" key={order.id}><div><strong>{order.orderNumber}</strong><div className="muted">{order.customerName || 'Walk-in'} · {new Date(order.createdAt).toLocaleString()}</div></div><div><strong>{money(order.totalAmountMinor, '$')}</strong><span className={order.paymentStatus === 'paid' ? 'paid' : 'pending'}>{order.paymentStatus}</span><button className="button secondary" onClick={async () => { try { const refreshed = await api.refreshOrder(order.id); setOrders((current) => current.map((item) => item.id === order.id ? refreshed : item)); } catch (e) { setError((e as Error).message); } }}>Refresh status</button></div></div>)}</div>}</section>}
  </main>;
}
