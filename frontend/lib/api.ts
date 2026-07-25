import { CartItem, CheckoutResponse, PricePreview, Product } from './types';

const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `Request failed (${response.status})`);
  return response.json() as Promise<T>;
}
export const api = {
  products: () => request<Product[]>('/catalog/products'),
  preview: (currency: string, items: CartItem[]) => request<PricePreview>('/orders/preview', { method: 'POST', body: JSON.stringify({ currency, items }) }),
  intake: (key: string, currency: string, items: CartItem[]) => request<{ operation: { id: string } }>('/checkout-intake', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ currency, items }) }),
  process: (operationId: string) => request<CheckoutResponse>(`/checkout/${operationId}/process`, { method: 'POST' }),
  getCheckout: (operationId: string) => request<CheckoutResponse>(`/checkout/${operationId}`),
};
