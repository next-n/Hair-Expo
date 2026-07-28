import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AuditService } from '../src/audit/audit.service';
import { CatalogImportService } from '../src/catalog/catalog-import.service';
import { CatalogService } from '../src/catalog/catalog.service';
import { CheckoutCoreService } from '../src/checkout-core/checkout-core.service';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { DatabaseService } from '../src/database/database.service';
import { OrdersService } from '../src/orders/orders.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { CatalogPriceSource } from '../src/pricing/catalog-price-source';
import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { PricingService } from '../src/pricing/pricing.service';

describe('new order recreation from an expired order', () => {
  it('preserves the old snapshot and creates a new operation and provider link', async () => {
    const database = new DatabaseService(':memory:');
    database.onModuleInit();
    new CatalogImportService(database).importFromFile(join(process.cwd(), 'data', 'trunov_price_list.csv'));
    const catalog = new CatalogService(database);
    const provider = new FakePaymentProvider();
    const core = new CheckoutCoreService(database, new PricingService(new DefaultPricingEngine(), new CatalogPriceSource(catalog)), provider);
    const intake = new CheckoutIntakeService(database, catalog);
    const catalogRow = database.connection.prepare('SELECT p.id AS productId, v.id AS variantId FROM products p JOIN product_variants v ON v.product_id = p.id WHERE p.is_active = 1 AND v.is_active = 1 ORDER BY p.sku LIMIT 1').get() as { productId: string; variantId: string };
    const operation = intake.intake('booth', randomUUID(), { currency: 'USD', customerName: 'Existing customer', customerContact: 'wechat', items: [{ productId: catalogRow.productId, variantId: catalogRow.variantId, quantity: 2 }] }).operation;
    const first = await core.process(operation.id);
    database.connection.prepare('UPDATE checkout_attempts SET payment_link_expires_at = ? WHERE checkout_operation_id = ?').run(new Date(Date.now() - 1_000).toISOString(), operation.id);
    database.connection.prepare('UPDATE order_items SET product_id = NULL, variant_id = NULL WHERE order_id = ?').run(first.orderId);
    const orders = new OrdersService(database, new AuditService(database), provider, core);

    const recreated = await orders.recreate(first.orderId!);
    const oldOrder = orders.get(first.orderId!) as unknown as { customerName: string; totalAmountMinor: number; items: Array<{ sku: string }> };
    const newOrder = orders.get(recreated.orderId!) as unknown as { customerName: string; totalAmountMinor: number; items: Array<{ sku: string; quantity: number }> };

    expect(recreated.orderId).not.toBe(first.orderId);
    expect(newOrder.customerName).toBe(oldOrder.customerName);
    expect(newOrder.totalAmountMinor).toBe(oldOrder.totalAmountMinor);
    expect(newOrder.items?.[0]).toEqual(expect.objectContaining({ sku: oldOrder.items?.[0].sku, quantity: 2 }));
    expect((oldOrder.items?.[0] as { productId?: string; variantId?: string })).toEqual(expect.objectContaining({ productId: catalogRow.productId, variantId: catalogRow.variantId }));
    expect(database.connection.prepare('SELECT recreated_from_order_id AS source FROM orders WHERE id = ?').get(recreated.orderId)).toEqual({ source: first.orderId });
    expect(orders.list('pending')).toHaveLength(2);
    expect(orders.list('paid')).toHaveLength(0);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    expect(orders.list('all', start.toISOString(), end.toISOString())).toHaveLength(2);
    expect(provider.callCount).toBe(2);
    expect(provider.deactivationCount).toBe(1);
    database.onModuleDestroy();
  });
});
