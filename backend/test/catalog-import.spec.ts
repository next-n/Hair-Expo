import { join } from 'node:path';
import { DatabaseService } from '../src/database/database.service';
import { CatalogImportService } from '../src/catalog/catalog-import.service';
import { CatalogService } from '../src/catalog/catalog.service';

describe('TRUNOV catalog import', () => {
  let database: DatabaseService;
  const catalogPath = join(process.cwd(), 'data', 'trunov_price_list.csv');
  beforeEach(() => { database = new DatabaseService(':memory:'); database.onModuleInit(); });
  afterEach(() => database.onModuleDestroy());

  it('imports exactly 75 unique products and preserves Trial Pack nullability', () => {
    const summary = new CatalogImportService(database).importFromFile(catalogPath);
    expect(summary.rowCount).toBe(75);
    expect(database.connection.prepare('SELECT COUNT(*) AS count, COUNT(DISTINCT sku) AS unique_count FROM products WHERE is_active = 1').get()).toEqual({ count: 75, unique_count: 75 });
    const trial = database.connection.prepare('SELECT sku, length_in, pack_weight_g, price_usd_minor, price_cny_minor FROM products WHERE sku = ?').get('PROMO-TRIAL');
    expect(trial).toEqual({ sku: 'PROMO-TRIAL', length_in: null, pack_weight_g: null, price_usd_minor: 14900, price_cny_minor: 99900 });
    const product = database.connection.prepare('SELECT id FROM products WHERE sku = ?').get('SD-KT-22') as { id: string };
    expect(new CatalogService(database).getPrice(product.id).sku).toBe('SD-KT-22');
    new CatalogImportService(database).importFromFile(catalogPath);
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active = 1').get()).toEqual({ count: 75 });
  });
});
