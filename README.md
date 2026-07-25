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

## Foundation scope

This phase defines the NestJS modules, SQLite migration infrastructure, catalog/order/checkout/payment/webhook/audit tables, replaceable pricing and payment interfaces, and a fake payment provider. Provider network calls are intentionally not implemented. Stripe, final pricing rules, tax, discounts, inventory, fulfillment, and frontend behavior remain for later phases when the assignment brief and CSV schema are available.
