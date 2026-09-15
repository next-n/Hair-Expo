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
  it('exposes per-gram pricing for per_100g and per_kg items', () => {
    const summary = new CatalogImportService(database).importFromFile(catalogPath);
    expect(summary.rowCount).toBe(75);
    const catalog = new CatalogService(database);

    const per100 = catalog.listProducts({ search: 'MG-GW-18' })[0];
    expect(per100.unit).toBe('per_100g');
    expect(per100.pricePerGramUsdMinor).toBe(85);   // $85 / 100g = $0.85/g
    expect(per100.pricePerGramCnyMinor).toBe(595);

    const perKg = catalog.listProducts({ search: 'RAW-SLV-1820' })[0];
    expect(perKg.unit).toBe('per_kg');
    expect(perKg.pricePerGramUsdMinor).toBe(120);   // $1200 / 1000g = $1.20/g
    expect(perKg.pricePerGramCnyMinor).toBe(840);

    const pack = catalog.listProducts({ search: 'MG-KT-18' })[0];
    expect(pack.unit).toBe('pack_100pcs');
    expect(pack.pricePerGramUsdMinor).toBeNull();   // pack items have no per-gram price
    expect(pack.pricePerGramCnyMinor).toBeNull();
  });
});
