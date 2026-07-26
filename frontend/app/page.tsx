'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { CartItem, CheckoutResponse, PricePreview, Product } from '../lib/types';

const CART_KEY = 'hair-expo-cart';
const INTENT_KEY = 'hair-expo-checkout-intent';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [length, setLength] = useState('');

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const saved = localStorage.getItem(CART_KEY); if (saved) setCart(JSON.parse(saved) as CartItem[]);
    api.session().then(() => api.products()).then((items) => { setProducts(items); if (items[0]) { setSelectedProduct(items[0].id); setSelectedVariant(items[0].variants[0]?.id ?? ''); } }).catch((e: Error) => setError(e.message));
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const add = () => {
    if (!selectedProduct || !selectedVariant) return;
    const next: CartItem = { productId: selectedProduct, variantId: selectedVariant, quantity, ...(weight ? { weightGrams: Number(weight) } : {}), ...(color ? { color } : {}), ...(length ? { lengthInches: Number(length) } : {}) };
    setCart((current) => [...current, next]); setPreview(null); setCheckout(null);
  };
  const remove = (index: number) => { setCart((current) => current.filter((_, itemIndex) => itemIndex !== index)); setPreview(null); setCheckout(null); };
  const previewCart = async () => { setBusy(true); setError(''); try { setPreview(await api.preview('USD', cart)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const checkoutNow = async () => {
    setBusy(true); setError('');
    try {
      let key = localStorage.getItem(INTENT_KEY); if (!key) { key = crypto.randomUUID(); localStorage.setItem(INTENT_KEY, key); }
      const intake = await api.intake(key, 'USD', cart); const result = await api.process(intake.operation.id); setCheckout(result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const newOrder = () => { setCart([]); setPreview(null); setCheckout(null); setError(''); localStorage.removeItem(INTENT_KEY); };

  return <main className="shell">
    <header className="topbar"><div><p className="status">Hair Expo · Booth checkout</p><h1 className="brand">Fast, clear checkout</h1></div><div className="status">{online ? '● Online' : '○ Offline — cart saved locally'}</div></header>
    <div className="grid">
      <section className="panel"><h2>Choose products</h2><div className="products">{products.map((item) => <article className="product" key={item.id}><div className="product-row"><strong>{item.name}</strong><span className="muted">{item.productType}</span></div><label>Variant<select value={selectedProduct === item.id ? selectedVariant : item.variants[0]?.id} onChange={(e) => { setSelectedProduct(item.id); setSelectedVariant(e.target.value); }}><option value="">Choose a variant</option>{item.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>{selectedProduct === item.id && <><div className="controls"><label>Qty<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></label><label>Weight (g)<input inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><label>Length (in)<input inputMode="numeric" value={length} onChange={(e) => setLength(e.target.value)} /></label></div><label>Color<input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Optional" /></label><button className="button" onClick={add}>Add to cart</button></>}</article>)}</div></section>
      <aside className="panel"><div className="product-row"><h2>Cart ({cartCount})</h2><button className="button secondary" onClick={newOrder}>New order</button></div><div className="cart">{cart.length === 0 ? <p className="muted">Add a product to begin.</p> : cart.map((item, index) => <div className="cart-row" key={`${item.productId}-${index}`}><span>{products.find((productItem) => productItem.id === item.productId)?.name ?? 'Product'} × {item.quantity}</span><button className="button secondary" onClick={() => remove(index)}>Remove</button></div>)}</div>{error && <p className="error">{error}</p>}{preview && <div className="success"><div className="total-row"><span>Subtotal</span><strong>{preview.subtotalMinor}¢</strong></div><div className="total-row"><span>Total</span><strong>{preview.totalMinor}¢</strong></div></div>}<div className="actions"><button className="button secondary" disabled={!cart.length || busy || !online} onClick={previewCart}>Preview backend price</button><button className="button" disabled={!cart.length || busy || !online} onClick={checkoutNow}>Checkout securely</button></div>{checkout?.checkoutUrl && <div className="qr"><strong>Show this QR at payment</strong><QRCodeSVG value={checkout.checkoutUrl} size={220} includeMargin /><a href={checkout.checkoutUrl} target="_blank" rel="noreferrer">Open fake payment page</a><span className="muted">Retrying this checkout returns the same URL.</span></div>}</aside>
    </div>
  </main>;
}
