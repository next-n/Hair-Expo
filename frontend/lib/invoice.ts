import { Order } from './types';
import { COMPANY_DETAILS, COMPANY_NAME } from './company';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function money(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return '—';
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function printInvoice(order: Order): void {
  const popup = window.open('', '_blank', 'popup,width=800,height=900');
  if (!popup) throw new Error('Allow pop-ups to print the invoice.');
  const currency = order.currency.toUpperCase() === 'CNY' ? '¥' : '$';
  const items = order.items ?? [];
  const rows = items.length > 0
    ? items.map((item) => `<tr><td>${escapeHtml(item.sku)}</td><td>${escapeHtml(item.line ?? item.productType ?? '')}</td><td>${item.quantity}</td><td>${money(item.lineTotalMinor, currency)}</td></tr>`).join('')
    : '<tr><td colspan="4">Order details are unavailable.</td></tr>';

  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(order.orderNumber)} invoice</title><style>
    body{font-family:Arial,sans-serif;color:#17202a;margin:40px;max-width:760px}header{display:flex;justify-content:space-between;border-bottom:2px solid #17202a;padding-bottom:18px}h1{margin:0 0 8px;font-size:24px}h2{margin-top:32px;font-size:18px}.muted{color:#667085}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;border-bottom:1px solid #e4e7ec;padding:10px 6px}.total{margin-top:24px;text-align:right;font-size:20px;font-weight:700}.status{color:#027a48;font-weight:700}@media print{body{margin:12mm}}
  </style></head><body><header><div><h1>${COMPANY_NAME}</h1><div class="muted">${COMPANY_DETAILS}</div></div><div><strong>Invoice / receipt</strong><br>${escapeHtml(order.orderNumber)}<br><span class="status">${escapeHtml(order.paymentStatus)}</span></div></header><h2>Customer</h2><div>${escapeHtml(order.customerName || 'Walk-in customer')}</div><div class="muted">${escapeHtml(order.customerContact || '')}</div><h2>Items</h2><table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${money(order.totalAmountMinor, currency)}</div><p class="muted">Generated ${escapeHtml(new Date(order.createdAt).toLocaleString())}</p></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}
