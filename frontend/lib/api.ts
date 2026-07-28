import { CartItem, CheckoutResponse, Order, PricePreview, Product } from './types';

const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4423';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
export const api = {
  session: () => request<{ status: string }>('/checkout-intake/session'),
  authSession: () => request<{ required: boolean; authorized: boolean }>('/auth/session'),
  unlock: (passcode: string) => request<{ status: string }>('/auth/unlock', { method: 'POST', body: JSON.stringify({ passcode }) }),
  products: (query = '') => request<Product[]>(`/catalog/products${query ? `?search=${encodeURIComponent(query)}` : ''}`),
  preview: (currency: string, items: CartItem[], expoDiscountEnabled: boolean) => request<PricePreview>('/orders/preview', { method: 'POST', body: JSON.stringify({ currency, items: items.map(({ sku: _sku, ...item }) => item), expoDiscountEnabled }) }),
  intake: (key: string, currency: string, items: CartItem[], customerName: string, customerContact: string, expoDiscountEnabled: boolean) => request<{ operation: { id: string } }>('/checkout-intake', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ currency, items: items.map(({ sku: _sku, ...item }) => item), customerName, customerContact, expoDiscountEnabled }) }),
  process: (operationId: string) => request<CheckoutResponse>(`/checkout/${operationId}/process`, { method: 'POST' }),
  getCheckout: (operationId: string) => request<CheckoutResponse>(`/checkout/${operationId}`),
  orders: (params?: { status?: 'paid' | 'pending' | 'all'; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<Order[]>(`/orders${suffix}`);
  },
  order: (id: string) => request<Order>(`/orders/${id}`),
  refreshOrder: (id: string) => request<Order>(`/orders/${id}/refresh`, { method: 'POST' }),
};
