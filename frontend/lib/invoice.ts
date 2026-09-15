import { COMPANY_DETAILS, COMPANY_NAME } from './company';
import { formatDate, formatExactCents, formatMinor, message, Locale } from './i18n';
import { Order, OrderItem } from './types';
function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function money(minor: number | null | undefined, currency: string, locale: Locale): string {
  return formatMinor(minor, currency, locale);
}

export function printInvoice(order: Order, locale: Locale = 'en'): void {
  const popup = window.open('', '_blank', 'popup,width=800,height=900');
  if (!popup) throw new Error('Allow pop-ups to print the invoice.');
  const currency = order.currency;
  const text = (key: Parameters<typeof message>[1], values?: Record<string, string | number>) => message(locale, key, values);
  const status = order.paymentStatus === 'paid' ? text('paid') : order.paymentStatus === 'review_required' ? text('reviewRequired') : text('pending');
  const discountLabel = order.selectedDiscountReason === 'VOLUME_DISCOUNT' ? text('volumeDiscount') : order.selectedDiscountReason === 'EXPO_DISCOUNT' ? text('expoDiscount') : text('discount');
  const items = order.items ?? [];
  

function itemQuantityLabel(item: OrderItem, locale: Locale, t: (key: Parameters<typeof message>[1], values?: Record<string, string | number>) => string): string {
  if (item.unit === 'per_100g' || item.unit === 'per_kg') {
    return item.weightContributionGrams != null
      ? `${new Intl.NumberFormat(locale).format(item.weightContributionGrams)} ${t('gramsUnit')}`
      : '—';
  }
  if (item.unit === 'pack_100pcs' || item.unit === 'pack_20pcs') {
    return item.piecesCount != null && item.piecesCount > 0
      ? `${new Intl.NumberFormat(locale).format(item.piecesCount)} ${t('piecesUnit')}`
      : '—';
  }
  return `${item.quantity}`;
}

function cleanItemName(
  item: OrderItem,
  locale: Locale,
  t: (key: Parameters<typeof message>[1], values?: Record<string, string | number>) => string,
  money: (minor: number | null | undefined, currency: string, locale: Locale) => string,
): string {
  const rawName = item.name ?? item.line ?? item.productType ?? '';
  const isGram = item.unit === 'per_100g' || item.unit === 'per_kg';
  const isPiece = item.unit === 'pack_100pcs' || item.unit === 'pack_20pcs';
  if (!isGram && !isPiece) return rawName;
  const cleaned = rawName
    .replace(/\s*per\s*100\s*g\s*$/i, '')
    .replace(/\s*per\s*kg\s*$/i, '')
    .replace(/\s*pack of \d+\s*$/i, '')
    .trim();
  const unitPrice = item.adjustedUnitAmountMinor;
  const unitLabel = isGram ? t('gramsUnit') : t('piecesUnit');
  return unitPrice != null ? `${cleaned} · ${money(unitPrice, 'USD', locale)} / ${unitLabel}` : cleaned;
}

const rows = items.length > 0
  ? items.map((item) => {
      const isBlonde = item.blonde === 1 || item.blonde === true;
      const isGram = item.unit === 'per_100g' || item.unit === 'per_kg';
      const isPiece = item.unit === 'pack_100pcs' || item.unit === 'pack_20pcs';
      const qtyLabel = isGram && item.weightContributionGrams != null
        ? `${new Intl.NumberFormat(locale).format(item.weightContributionGrams)} ${text('gramsUnit')}`
        : isPiece && item.piecesCount != null && item.piecesCount > 0
          ? `${new Intl.NumberFormat(locale).format(item.piecesCount)} ${text('piecesUnit')}`
          : null;
      const skuLabel = [item.sku, isBlonde ? text('blonde') : null, qtyLabel].filter(Boolean).join(' · ');
      const productCell = (() => {
        const rawName = item.line ?? item.productType ?? '';
        if (!isGram && !isPiece) return rawName;
        const cleaned = rawName
          .replace(/\s*per\s*100\s*g\s*$/i, '')
          .replace(/\s*per\s*kg\s*$/i, '')
          .replace(/\s*pack of \d+\s*$/i, '')
          .trim();
        const unitLabel = isGram ? text('gramsUnit') : text('piecesUnit');
        const divisor = item.unit === 'per_100g' ? 100
                      : item.unit === 'per_kg' ? 1000
                      : item.unit === 'pack_100pcs' ? 100
                      : item.unit === 'pack_20pcs' ? 20
                      : 1;
        const baseUnitCents = item.baseUnitAmountMinor != null ? item.baseUnitAmountMinor / divisor : null;
        const exactUnitCents = baseUnitCents != null && isBlonde ? baseUnitCents * 1.30 : baseUnitCents;
        return exactUnitCents != null ? `${cleaned} · ${formatExactCents(exactUnitCents)} / ${unitLabel}` : cleaned;
      })();
      return `<tr>
        <td>${escapeHtml(skuLabel)}</td>
        <td>${escapeHtml(productCell)}</td>
        <td>${isGram || isPiece ? '—' : item.quantity}</td>
        <td>${item.weightContributionGrams == null ? '—' : `${new Intl.NumberFormat(locale).format(item.weightContributionGrams)} g`}</td>
        <td>${money(item.lineTotalMinor, currency, locale)}</td>
      </tr>`;
    }).join('')
  : `<tr><td colspan="5">${text('customerDetailsUnavailable')}</td></tr>`;
  const summaryRows = [
    order.subtotalMinor == null ? '' : `<tr><td>${text('subtotal')}</td><td>${money(order.subtotalMinor, currency, locale)}</td></tr>`,
    ...(order.adjustments ?? []).filter((adjustment) => adjustment.scope === 'ORDER').map((adjustment) => `<tr><td>${escapeHtml(adjustment.label)}</td><td>${adjustment.type === 'DISCOUNT' ? '−' : '+'}${money(adjustment.amountMinor, currency, locale)}</td></tr>`),
    `<tr class="grand-total"><td>${text('usdTotal')}</td><td>${money(order.totalAmountMinor, currency, locale)}</td></tr>`,
    order.totalCnyMinor == null ? '' : `<tr><td>${text('cnyReference')}</td><td>${money(order.totalCnyMinor, 'CNY', locale)}</td></tr>`,
  ].join('');

  popup.document.write(`<!doctype html><html lang="${locale}"><head><title>${escapeHtml(order.orderNumber)} ${text('invoiceReceipt')}</title><style>
    body{font-family:Arial,sans-serif;color:#17202a;margin:40px;max-width:760px}header{display:flex;justify-content:space-between;border-bottom:2px solid #17202a;padding-bottom:18px}h1{margin:0 0 8px;font-size:24px}h2{margin-top:32px;font-size:18px}.muted{color:#667085}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;border-bottom:1px solid #e4e7ec;padding:10px 6px}td:last-child,th:last-child{text-align:right}.summary{max-width:420px;margin-left:auto}.summary .grand-total td{font-size:20px;font-weight:700;border-top:2px solid #17202a}.status{color:#027a48;font-weight:700}@media print{body{margin:12mm}}
  </style></head><body><header><div><h1>${escapeHtml(COMPANY_NAME)}</h1><div class="muted">${escapeHtml(COMPANY_DETAILS)}</div></div><div><strong>${text('invoiceReceipt')}</strong><br>${escapeHtml(order.orderNumber)}<br><span class="status">${escapeHtml(status)}</span></div></header><h2>${text('invoiceCustomer')}</h2><div>${escapeHtml(order.customerName || text('walkIn'))}</div><div class="muted">${escapeHtml(order.customerContact || '')}</div><h2>${text('invoiceItems')}</h2><table><thead><tr><th>SKU</th><th>${text('invoiceProduct')}</th><th>${text('invoiceQuantity')}</th><th>${text('weight')}</th><th>${text('invoiceAmount')}</th></tr></thead><tbody>${rows}</tbody></table><table class="summary"><tbody>${summaryRows}</tbody></table><p class="muted">${text('generated', { date: formatDate(order.createdAt, locale) })}</p></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}
