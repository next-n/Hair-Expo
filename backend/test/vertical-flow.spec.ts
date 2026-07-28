import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { CatalogImportService } from '../src/catalog/catalog-import.service';
import { CatalogService } from '../src/catalog/catalog.service';
import { CheckoutCoreService } from '../src/checkout-core/checkout-core.service';
import { CheckoutIntakeService } from '../src/checkout-intake/checkout-intake.service';
import { DatabaseService } from '../src/database/database.service';
import { FakePaymentProvider } from '../src/payment-provider/fake-payment-provider';
import { DefaultPricingEngine } from '../src/pricing/default-pricing-engine';
import { CatalogPriceSource } from '../src/pricing/catalog-price-source';
import { BlondeSurchargeRule } from '../src/pricing/rules/blonde-surcharge.rule';
import { ExpoDiscountRule } from '../src/pricing/rules/expo-discount.rule';
import { VolumeDiscountRule } from '../src/pricing/rules/volume-discount.rule';
import { PricingService } from '../src/pricing/pricing.service';

describe('real catalog to mock payment vertical flow', () => {
  it('imports, previews, intakes, creates one fake link, and persists snapshots', async () => {
    const database = new DatabaseService(':memory:'); database.onModuleInit();
    new CatalogImportService(database).importFromFile(join(process.cwd(), 'data', 'trunov_price_list.csv'));
    const catalog = new CatalogService(database);
    const source = new CatalogPriceSource(catalog);
    const pricing = new PricingService(new DefaultPricingEngine([
      new BlondeSurchargeRule({ enabled: true }), new ExpoDiscountRule({ enabled: true }), new VolumeDiscountRule({ enabled: true }),
    ]), source);
    const intake = new CheckoutIntakeService(database, catalog);
    const provider = new FakePaymentProvider();
    const core = new CheckoutCoreService(database, pricing, provider);
    const normal = database.connection.prepare('SELECT id, product_id FROM product_variants WHERE sku = ?').get('SD-KT-22') as { id: string; product_id: string };
    const raw = database.connection.prepare('SELECT id, product_id FROM product_variants WHERE sku = ?').get('RAW-MM-24') as { id: string; product_id: string };
    const operation = intake.intake('booth-session', randomUUID(), {
      currency: 'USD', customerName: 'Test customer', customerContact: 'wechat-test', expoDiscountEnabled: true,
      items: [
        { productId: normal.product_id, variantId: normal.id, quantity: 1, blonde: false },
        { productId: normal.product_id, variantId: normal.id, quantity: 1, blonde: true },
        { productId: raw.product_id, variantId: raw.id, quantity: 3 },
      ],
    }).operation;
    const result = await core.process(operation.id);
    expect(result.checkoutUrl).toMatch(/^https:\/\/fake-payments\.invalid\/checkout\//);
    expect(result.paymentLinkExpiresAt).toBeTruthy();
    expect(database.connection.prepare('SELECT payment_link_created_at, payment_link_expires_at FROM checkout_attempts WHERE checkout_operation_id = ?').get(operation.id)).toEqual(expect.objectContaining({ payment_link_created_at: expect.any(String), payment_link_expires_at: expect.any(String) }));
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM orders').get()).toEqual({ count: 1 });
    expect(database.connection.prepare('SELECT total_amount_minor, total_cny_minor, selected_discount_reason, customer_name FROM orders').get()).toEqual({ total_amount_minor: 250200, total_cny_minor: 1751400, selected_discount_reason: 'EXPO_DISCOUNT', customer_name: 'Test customer' });
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM order_items').get()).toEqual({ count: 3 });
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM pricing_adjustments WHERE code = ?').get('BLONDE_SURCHARGE')).toEqual({ count: 1 });
    expect(provider.callCount).toBe(1);
    database.onModuleDestroy();
  });
});
