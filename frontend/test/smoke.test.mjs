import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('frontend application entrypoint exists', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /export default function HomePage/);
  assert.match(page, /setInterval/);
  assert.match(page, /paidStartNewOrder/);
  assert.match(page, /LanguageSwitcher/);
  assert.match(page, /mergeCartItems/);
  assert.match(page, /productSearchRank/);
  assert.match(page, /CHECKOUT_KEY/);
  assert.doesNotMatch(page, /checkout\.checkoutUrl} target="_blank"/);
});

test('order status route exists', async () => {
  const page = await readFile(new URL('../app/orders/[orderId]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /export default function OrderPage/);
  assert.match(page, /setInterval/);
  assert.match(page, /createCheckoutDraftFromOrder/);
  assert.match(page, /localStorage\.setItem\(CART_KEY/);
  assert.match(page, /REORDER_DISCOUNT_KEY/);
  assert.doesNotMatch(page, /api\.recreateOrder/);
  assert.match(page, /t\('reorder'\)/);
  assert.doesNotMatch(page, /order\.checkoutUrl!} target="_blank"/);
});

test('orders list route exists', async () => {
  const page = await readFile(new URL('../app/orders/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /export default function OrdersPage/);
  assert.match(page, /printPdf/);
  assert.match(page, /href="\/"/);
  assert.match(page, /COMPANY_DETAILS/);
  assert.match(page, /company-link/);
  assert.match(page, /customerSearch/);
  assert.match(page, /loading-spinner/);
  assert.match(page, /pageshow/);
  assert.match(page, /pagehide/);
});

test('supported locales include Burmese', async () => {
  const i18n = await readFile(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  assert.match(i18n, /'my'/);
  assert.match(i18n, /burmese: 'မြန်မာ'/);
  assert.match(i18n, /browser\.startsWith\('my'\)/);
  assert.match(i18n, /option value="my"/);
  assert.match(i18n, /errorQuantityLimit/);
  assert.match(i18n, /outside the allowed range/);
});

test('invoice includes the backend pricing breakdown', async () => {
  const invoice = await readFile(new URL('../lib/invoice.ts', import.meta.url), 'utf8');
  assert.match(invoice, /selectedDiscountReason/);
  assert.match(invoice, /discountMinor/);
  assert.match(invoice, /invoiceSurcharge/);
  assert.match(invoice, /cnyReference/);
  assert.match(invoice, /weightContributionGrams/);
  assert.doesNotMatch(invoice, /totalWeightGrams == null/);
});
