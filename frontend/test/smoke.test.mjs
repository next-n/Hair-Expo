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
  assert.match(page, /REORDER_NOTICE_KEY/);
  assert.match(page, /cart-jump-attention/);
  assert.match(page, /reorderCartHint/);
  assert.doesNotMatch(page, /checkout\.checkoutUrl} target="_blank"/);
});

test('order status route exists', async () => {
  const page = await readFile(new URL('../app/orders/[orderId]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /export default function OrderPage/);
  assert.match(page, /setInterval/);
  assert.match(page, /createCheckoutDraftFromOrder/);
  assert.match(page, /localStorage\.setItem\(CART_KEY/);
  assert.match(page, /REORDER_DISCOUNT_KEY/);
  assert.match(page, /REORDER_NOTICE_KEY/);
  assert.match(page, /formatDate\(order\.createdAt/);
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

test('guide presents the technology stack', async () => {
  const guide = await readFile(new URL('../app/guide/guide-content.tsx', import.meta.url), 'utf8');
  assert.match(guide, /builtWith/);
  assert.match(guide, /Next\.js · React · TypeScript/);
  assert.match(guide, /NestJS · Node\.js · TypeScript/);
  assert.match(guide, /Stripe Checkout · webhooks/);
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
