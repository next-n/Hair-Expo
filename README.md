# Hair Expo Checkout

NestJS backend and Next.js tablet-first frontend for a small expo checkout and payment tool.

## Repository structure

```text
backend/    NestJS modular monolith, SQLite migrations, pricing, checkout, fake provider
frontend/   Next.js App Router booth checkout UI
AGENTS.md   permanent engineering constraints
```

## Requirements

- Node.js 20+
- npm 10+

## Backend setup

```bash
cd backend
npm install --legacy-peer-deps
Copy-Item .env.example .env
npm run build
npm run typecheck
npm test
npm run lint
npm run start:dev
```

Backend environment variables are `PORT` and `DATABASE_PATH`. The backend loads `.env` at startup and runs migrations automatically.

## Frontend setup

```bash
cd frontend
npm install
Copy-Item .env.example .env.local
npm run typecheck
npm run lint
npm run build
npm run dev
```

The frontend uses `NEXT_PUBLIC_BACKEND_URL` and does not contain authoritative pricing logic.

Checkout intake is scoped to a server-issued HTTP-only booth-session cookie; the client cannot choose an actor identity. Intake rejects empty carts and applies operational request bounds. The mock catalog is seeded into SQLite by migration and read through `CatalogService`, so the API does not use a separate in-memory catalog.

The default database is `./data/hair-expo.sqlite`. The application creates its parent directory, enables SQLite WAL mode, foreign keys, `busy_timeout=5000`, and `synchronous=FULL`, then applies pending migrations on startup.

Set `DATABASE_PATH` to use another SQLite file. Tests use temporary databases and do not modify the development database.

## API and mock flow

- `GET /health`
- `GET /catalog/products`
- `POST /orders/preview` — backend-only price preview
- `POST /checkout-intake` — durable idempotent intake
- `POST /checkout/:operationId/process` — fake provider checkout
- `GET /checkout/:operationId` — operation status/retry lookup

The frontend persists its draft cart in local storage, reuses one idempotency key for one checkout intention, submits all previews and totals to the backend, and renders the stable fake checkout URL as a QR code. Starting a new order clears the cart and creates a new intent key.

## CI

GitHub Actions runs install, type-check, lint, tests, and production builds for both `backend/` and `frontend/` on pushes to `main` and pull requests.

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

Stripe, authentication, final pricing rules, tax, discounts, inventory, fulfillment, settlement, and frontend production polish remain unresolved until the assignment brief and CSV schema arrive. Kafka, microservices, wallet ledger, KYC, and settlement are out of scope.
