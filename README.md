# TRUNOV HAIR Expo Checkout

Tablet-first NestJS + Next.js checkout tool for the China Hair Expo booth. The backend is the authority for catalog data, pricing, order snapshots, idempotency, and payment status. Payment-link safety is built around one checkout identity from the client idempotency key through the SQLite operation, order, attempt, and stable Stripe idempotency key; atomic claims, short leases with fencing tokens, stored-result reuse, signed webhook deduplication, and Payment Link deactivation prevent duplicate operations and unsafe retries. See the [Payment Idempotency Design](docs/hair-expo-payment-idempotency.pdf) technical note for the full flow and failure cases.

## Repository

```text
backend/    NestJS modular monolith, SQLite, catalog import, pricing, checkout, Stripe, webhooks
frontend/   Next.js App Router tablet checkout and orders screen
backend/data/trunov_price_list.csv   unchanged authoritative 75-row source CSV
```

## Local setup

Requirements: Node.js 20+ and npm 10+.

```bash
cd backend
npm ci
cp .env.example .env
# Keep PAYMENT_PROVIDER=fake for local development without Stripe credentials.
npm run typecheck
npm test
npm run lint
npm run build
npm run start:dev
```

In another terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

The backend defaults to `./data/hair-expo.sqlite`. It creates the directory, enables WAL mode, foreign keys, `busy_timeout=5000`, and `synchronous=FULL`, then applies migrations. Back up the SQLite database together with its WAL state after stopping the app; do not copy a live database while it is being written.

Deployment requirement: run one backend instance with a persistent disk for `DATABASE_PATH`. Do not deploy this SQLite writer on an ephemeral or horizontally scaled filesystem; a redeploy must preserve the database, `-wal`, and `-shm` files.

## Production deployment layout

The production server keeps the Git checkout, runtime configuration, and SQLite data in separate locations:

```text
/opt/hair-expo                 Git checkout and Docker build context
/opt/hair-expo/backend         NestJS backend source
/etc/hair-expo/backend.env     protected backend runtime environment
/etc/hair-expo/frontend.env    protected frontend runtime/build environment
/var/lib/hair-expo             persistent SQLite database, WAL, and SHM files
```

The production Compose file is `deploy/docker-compose.production.yml`. It loads `/etc/hair-expo/backend.env` and `/etc/hair-expo/frontend.env` with `env_file`; those files are not part of the repository and must never be committed. Deploy or restart the application from the checkout with:

```bash
cd /opt/hair-expo
docker compose --env-file /etc/hair-expo/frontend.env \
  -f deploy/docker-compose.production.yml up -d --build
```

The backend container reads its settings through `process.env`, while the frontend public settings are passed as build arguments and runtime environment values. Keep Stripe keys, webhook secrets, and booth passcodes only in the protected server environment files.

## Backup and restore verification

The SQLite database is production state and must be backed up independently of the Git checkout, Docker images, and environment files. The repository includes `deploy/hair-expo-backup.sh`, which contains no secrets and should be installed as a root-owned server utility:

```bash
sudo install -o root -g root -m 700 deploy/hair-expo-backup.sh /usr/local/sbin/hair-expo-backup.sh
sudo install -o root -g root -m 644 deploy/hair-expo-backup.service /etc/systemd/system/hair-expo-backup.service
sudo install -o root -g root -m 644 deploy/hair-expo-backup.timer /etc/systemd/system/hair-expo-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now hair-expo-backup.timer
```

The timer runs an online SQLite backup every five minutes. Each successful backup is written under `/var/backups/hair-expo`, receives a SHA-256 sidecar, is checked for SQLite integrity and foreign-key violations, and is checked against the expected application schema. The default retention is 288 backups (24 hours at five-minute intervals); set `HAIR_EXPO_BACKUP_RETENTION` in `/etc/default/hair-expo-backup` if a longer local window is required.

Check the schedule and run a restore rehearsal with:

```bash
systemctl list-timers hair-expo-backup.timer
sudo journalctl -u hair-expo-backup.service --since today
sudo /usr/local/sbin/hair-expo-backup.sh status
sudo /usr/local/sbin/hair-expo-backup.sh restore-verify
```

`restore-verify` checks the checksum of the newest backup and opens it as a temporary database inside the backend runtime. It never replaces `/var/lib/hair-expo/hair-expo.sqlite`; an actual restore remains a separately approved maintenance operation. Local backups protect against application mistakes but not disk loss or server loss, so copy verified backups to independent storage as an operational follow-up.

## Environment

Backend `.env`:

```text
PORT=4423
DATABASE_PATH=./data/hair-expo.sqlite
PAYMENT_PROVIDER=fake
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:4421
CORS_ALLOWED_ORIGINS=http://localhost:4421
APP_PASSCODE=change-me
AUTH_MAX_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_SECONDS=900
CATALOG_CSV_PATH=./data/trunov_price_list.csv
CHECKOUT_MAX_QUANTITY=10000
```

Set `PAYMENT_PROVIDER=stripe` only with a Stripe test key. Startup rejects keys that do not begin with `sk_test_`. Secrets are server-only, ignored by Git, and never sent to the frontend. `APP_PASSCODE` enables the small signed HttpOnly-cookie booth boundary; leaving it empty disables the boundary for local development.

`CHECKOUT_MAX_QUANTITY` is an operational request-safety ceiling, not a pricing or catalog rule. It defaults to 10,000 units per line and can be raised through the backend environment when a wholesale order requires more; the frontend does not impose a separate business quantity limit.

`CORS_ALLOWED_ORIGINS` is a comma-separated exact-origin allowlist and defaults to `FRONTEND_URL`. Credentials are accepted only from those origins. Failed booth passcode attempts are rate-limited per client using `AUTH_MAX_ATTEMPTS` within `AUTH_RATE_LIMIT_WINDOW_SECONDS`; production cookies also include `Secure`.

Frontend `.env.local`:

```text
NEXT_PUBLIC_BACKEND_URL=http://localhost:4423
NEXT_PUBLIC_INVOICE_COMPANY_NAME=TRUNOV HAIR
NEXT_PUBLIC_INVOICE_COMPANY_DETAILS=Expo booth · Company details placeholder
NEXT_PUBLIC_GUIDE_CHECKOUT_URL=/
NEXT_PUBLIC_GUIDE_VIDEO_URL=
NEXT_PUBLIC_GUIDE_URL=https://guide.guangzhouhairexpo.asia
```

Invoice company details are public frontend configuration, not secrets. Change these values in `frontend/.env.local` and restart the frontend before printing new invoices. `NEXT_PUBLIC_GUIDE_URL` controls the checkout page's link to the public guide; it falls back to the local `/guide` route when unset. Booth staff do not edit company identity per order.

`/guide` is a public, static project guide and tutorial page. It does not call the backend, create checkout operations, load orders, or poll payment status. `NEXT_PUBLIC_GUIDE_VIDEO_URL` is an optional public link to the five-minute screen recording; leave it empty to show the reserved video placeholder. The live checkout link remains protected by the booth passcode, which should be sent to reviewers separately rather than placed in the page or repository.

For production on `guide.guangzhouhairexpo.asia`, set `NEXT_PUBLIC_GUIDE_CHECKOUT_URL=https://checkout.guangzhouhairexpo.asia` in the frontend deployment environment so the guide's checkout links leave the guide host. The repository includes `deploy/nginx-guide-https.conf`, which proxies the public guide host to the static Next.js `/guide` route, caches guide HTML and assets, and rate-limits requests per client IP.

## Localization

The frontend supports English (`en`), Simplified Chinese (`zh-CN`), Russian (`ru`), and Burmese (`my`). The language selector is available on the booth, orders, and order-status screens; the public project guide offers English, Chinese, and Russian. The selected locale is stored in the browser under `hair-expo-locale`, so a refresh keeps the operator's choice; a first visit uses the browser language when it matches a supported locale and otherwise falls back to English.

User-interface text is kept in `frontend/lib/i18n.tsx`. Backend error codes are mapped to localized messages at the frontend boundary, while catalog names, SKUs, product attributes, and pricing-rule codes remain source/business data rather than translated UI copy. Money and dates are formatted for display with `Intl`; authoritative amounts remain integer minor units from the backend and are never recalculated in the browser. Invoice printouts use the selected locale and the public company values from `frontend/.env.local`.

To add or replace a translation, update the message dictionaries in `frontend/lib/i18n.tsx` for all supported locales and keep the message keys identical. To add a language, extend the locale type, dictionary, browser-language mapping, and selector options together, then add smoke coverage for the new option.

## Catalog import

The supplied CSV is stored unchanged at `backend/data/trunov_price_list.csv`. On startup, `CatalogImportService` validates the exact required columns, supported units, positive prices, nullable Trial Pack fields, exactly 75 rows, and unique SKUs. It computes a SHA-256 checksum and creates or reuses a price-list version. Importing is transactional and idempotent; restarting the app does not duplicate products. USD prices are stored in cents and CNY prices in fen. A later source file produces a new checksum/version and preserves existing order snapshots.

## Pricing rules

Pricing is backend-only. Controllers, the frontend, and payment providers do not calculate authoritative totals.

The deterministic pipeline is:

1. Load the product and immutable USD/CNY price snapshot from SQLite.
2. Calculate base line totals and weight contributions. `per_kg` contributes 1,000 g per unit. Missing Trial Pack weight contributes 0 g until clarified.
3. Apply item-level blonde surcharge: 3,000 basis points (30%) to the selected line before quantity multiplication.
4. Calculate the subtotal after item surcharges.
5. Select one order discount: volume (1,000 basis points) wins at 10,000 g or more; otherwise Expo (1,000 basis points) applies when enabled by default.
6. Apply deterministic integer half-up rounding in cents/fen.
7. Clamp USD and CNY reference totals at zero and return an immutable price snapshot.

USD is the Stripe source amount. CNY is a reference/display amount calculated independently from the supplied CNY catalog prices; it is not an exchange-rate conversion. The selected discount reason is persisted with the order and adjustments. Trial Pack is currently included in the eligible subtotal, and its missing weight is treated as zero as required by the current brief.

The exact brief example is covered by `backend/test/trunov-pricing.spec.ts`: 2 × SD-KT-22 with one blonde line plus 3 × RAW-MM-24 produces USD `$2,502.00` and CNY `¥17,514.00` after Expo discount.

## Checkout and idempotency

The frontend keeps one UUID idempotency key per checkout intention in local storage. It reuses that key after a timeout, reconnect, or duplicate click. Only “New order” clears it. The backend canonicalizes customer data, item identities/SKUs, quantities, blonde flags, and Expo toggle, hashes the representation with SHA-256, and enforces `(actor/session, operation type, idempotency key)` uniqueness in SQLite.

Local writes are short transactions. The checkout operation/order/price snapshot is committed before any Stripe call. Stripe calls use stable keys:

```text
trunov:product:<checkoutOperationId>
trunov:price:<checkoutOperationId>
trunov:payment-link:<checkoutOperationId>
```

A provider timeout moves the operation to `review_required` without creating another local order. Retrying reuses the same order and provider keys. A duplicate successful request returns the existing Payment Link and QR source URL.

Processing claims use a two-minute lease. Once the local transaction enters `payment_pending`, the checkout core renews that lease every 30 seconds while the provider request is running, so a live request is not reclaimed merely because the provider call is slow. If the process crashes, the lease eventually expires and a retry may resume with the same stable provider idempotency key. A lease token fences stale requests from saving a late success or failure over the current operation. The provider call remains outside local transactions.

Stripe webhook payment confirmation validates the signed Checkout Session against the local order before changing status: amount, currency, and Payment Link must all match the immutable order snapshot. A second paid session for an already-paid order is recorded as `DUPLICATE_PAYMENT_DETECTED` with `manual_refund_review` metadata and does not reapply the payment. Manual status refresh uses the same amount, currency, and Payment Link checks.

## Stripe test mode

With a test key configured:

```bash
cd backend
$env:PAYMENT_PROVIDER='stripe'
npm run start:dev
```

The adapter creates one order-specific Stripe Product, USD Price, and Payment Link. Stripe receives one summary line such as `TRUNOV HAIR Order EXPO-1234ABCD`, quantity 1, the authoritative USD total, and local order metadata. Returned objects are rejected if `livemode` is true. The Stripe SDK is pinned to `17.7.0` and the adapter pins API version `2024-06-20`.

Forward webhooks locally with Stripe CLI:

```bash
stripe listen --forward-to localhost:4423/webhooks/stripe
```

Copy the CLI `whsec_...` value into `STRIPE_WEBHOOK_SECRET`. The raw body is preserved, signatures are verified, and only paid `checkout.session.completed` events can mark an order paid. Event IDs are unique; duplicate deliveries return HTTP 200 without applying a second effect. The orders screen also exposes a manual refresh fallback.

After the first valid paid event, the backend deactivates the associated Payment Link outside the database transaction and records the deactivation locally. If deactivation fails, the webhook is rejected so Stripe can retry it. Stripe checkout-session, payment-intent, and payment-link identifiers are unique in the local database, and paid transitions are conditional.

For HTTPS deployment, use `deploy/nginx-hair-expo.conf` as the certificate/bootstrap configuration, obtain the certificate with Certbot, then use `deploy/nginx-hair-expo-https.conf`. The HTTPS configuration redirects port 80 to HTTPS, proxies both domains, and rate-limits `/auth/unlock` at the edge. The application also enforces the CORS allowlist and passcode rate limit so the boundary remains protected if the backend is reached through another trusted proxy.

## API

- `GET /health`
- `GET /auth/session`, `POST /auth/unlock`
- `GET /catalog/products?search=...`
- `POST /orders/preview`
- `GET /orders`, `GET /orders/:id`, `POST /orders/:id/refresh`
- `GET /checkout-intake/session`, `POST /checkout-intake`
- `POST /checkout/:operationId/process`, `GET /checkout/:operationId`
- `POST /webhooks/stripe`

## Frontend workflow

The main screen supports catalog search with relevance ranking (SKU matches first, then product name/type and substring matches), one-click normal/blonde additions, merging of identical product/variant/option lines, separate normal and blonde lines, editable quantities, quantity steppers, Expo toggle, backend preview, customer name/contact, QR code from the returned Stripe URL, retry, and New Order. The cart, customer draft, discount toggle, and current idempotency key survive refresh and offline periods. The frontend displays backend results only; it does not reproduce pricing rules.

## CI and verification

GitHub Actions runs `npm ci`, tests, type-check, lint, and production build for both projects. Local verification:

```bash
cd backend
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build

cd ../frontend
npm test
npm run typecheck
npm run lint
npm run build
```

The backend tests cover the 75-product import, exact assignment calculation, non-stacking discounts, missing Trial Pack fields, duplicate intake, concurrent processing, lease recovery, provider boundaries, webhook deactivation, migrations, and immutable deterministic pricing. Stripe tests should use mocked provider boundaries; a real test payment still requires the manual Stripe setup above.

## AI Workflow and Verification

OpenAI Codex was used as the coding assistant for this repository. Cursor, Claude Code, and GitHub Copilot were not used. AI-generated code was treated as a draft: the implementation was reviewed against the assignment, the confirmed architecture, and the payment-safety requirements before it was kept.

Examples of prompts used during the project included:

1. “Implement the pricing foundation with replaceable rules, integer minor units, deterministic rounding, and tests.”
2. “Review pricing as if it handles real payment amounts; check floating point, duplicate discounts, ordering, mutation, and negative totals.”
3. The real-production hardening review:

   > Remaining real-production concerns
   > 1. Validate payment amount in the webhook
   >
   > The webhook verifies Stripe’s signature and checks that the session is paid, but it does not compare:
   > `session.amount_total == order.total_amount_minor`
   > `session.currency == order.currency`
   > `session.payment_link == expected payment link`
   > before marking the order paid.
   >
   > 2. Detect a second real payment
   >
   > Two customers could open the same Payment Link before the first payment webhook deactivates it. A second successful Checkout Session should create `DUPLICATE_PAYMENT_DETECTED` and require manual refund review.
   >
   > 3. Harden the web boundary
   >
   > CORS currently accepts reflected origins with credentials. Cookies also lack the Secure flag, while the included Nginx configuration only listens on HTTP. Before public deployment: allow only the frontend domain, add Secure to production cookies, enable HTTPS and HTTP-to-HTTPS redirect, and rate-limit passcode attempts.

Verification included:

- Reviewing migrations, SQLite constraints, transaction boundaries, lease fencing, provider calls, canonical request construction, and webhook handling.
- Checking that Stripe calls occur outside database transactions and that frontend totals are never trusted as authoritative payment amounts.
- Running backend and frontend tests, type-checks, lint, and production builds.
- Running focused tests for migrations, catalog import, pricing arithmetic, duplicate rules, idempotent intake, concurrent processing, lease recovery, provider idempotency, webhook deduplication, amount/currency/Payment Link validation, duplicate-payment detection, and authentication rate limiting.
- Checking production health, HTTPS redirects, exact CORS behavior, container status, and the absence of committed secrets.
- Correcting issues found during verification, including a Nest provider-construction issue, a foreign-key ordering/reference issue, an outdated fake-provider idempotency assertion, and the production webhook/web-boundary hardening gaps above.

No unconfirmed pricing, catalog, refund, or settlement rules were invented. Where the assignment was silent, the behavior remains documented as an assumption or is kept behind a replaceable boundary.

## Screen-recording checklist

1. Open the deployed app and unlock with the booth passcode.
2. Search and add products.
3. Add one normal and one blonde line of the same SKU.
4. Show the valid Expo or volume discount.
5. Create a Payment Link and QR.
6. Open Stripe Checkout and pay with a test card such as `4242 4242 4242 4242`.
7. Return to the order screen and show status becoming paid after the webhook.
8. Open Orders and refresh the list.
9. Demonstrate refresh/offline cart recovery if time permits.

## Known limitations and manual work

- A real Stripe test key, webhook secret, deployed HTTPS URL, and Stripe CLI/live test payment must be supplied by the operator; none are committed.
- The current free-form search is intentionally simple; dedicated filter controls can be added after the live-call usability check.
- Trial Pack missing weight is explicitly assumed to be 0 g, and Trial Pack remains discount eligible, pending company clarification.
- Deployment provider setup, DNS/HTTPS, and the final screen recording remain operational deliverables rather than repository changes.

Inventory, refunds, roles, analytics, Kafka, Redis, microservices, and server-generated PDF files are intentionally not implemented. The frontend provides a printable invoice view that can be saved as PDF by the browser.
