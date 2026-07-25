# Hair Expo Checkout

Backend foundation for a small expo checkout and payment tool.

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
Copy-Item .env.example .env
npm run build
npm test
npm run lint
npm run start:dev
```

The application loads `.env` at startup.

The default database is `./data/hair-expo.sqlite`. The application creates its parent directory, enables SQLite WAL mode, foreign keys, `busy_timeout=5000`, and `synchronous=FULL`, then applies pending migrations on startup.

Set `DATABASE_PATH` to use another SQLite file. Tests use temporary databases and do not modify the development database.

## Pricing architecture

Pricing is backend-only. `PricingService` resolves a normalized order draft into catalog/price data, then delegates calculation to the injected `PricingEngine`. Controllers and payment providers never calculate or trust client totals.

The default pipeline is deterministic:

1. Calculate base line totals using integer minor units.
2. Apply item-level surcharges or discounts.
3. Calculate the subtotal after item adjustments.
4. Apply order-level adjustments, including discounts.
5. Apply currency-rounding policy.
6. Clamp the final total at zero and return an immutable price snapshot.

Percentage calculations use integer basis points (`10000` basis points = `100%`) and an explicit `FLOOR`, `CEIL`, or `HALF_UP` rounding mode. Money is never represented with JavaScript floating-point arithmetic.

To add or replace a rule, implement `PricingRule`, give it a stable `code` and `version`, declare its scope, and register it in `PricingModule`. Rules receive immutable context and must return adjustments without changing their input. Rule order is stable by code and version, and duplicate rule codes are applied at most once per scope.

Blonde, expo, volume, Trial Pack, and CNY behavior are intentionally disabled placeholders. Their thresholds, percentages, eligibility, product mappings, currency behavior, and price-list semantics await the actual assignment brief and CSV schema. The current mock price source uses 100 minor units only to keep the development checkout vertical runnable; it is not a production price rule.

## Foundation scope

This phase defines the NestJS modules, SQLite migration infrastructure, catalog/order/checkout/payment/webhook/audit tables, replaceable pricing and payment interfaces, and a fake payment provider. Provider network calls are intentionally not implemented. Stripe, final pricing rules, tax, discounts, inventory, fulfillment, and frontend behavior remain for later phases when the assignment brief and CSV schema are available.
