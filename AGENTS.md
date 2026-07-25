# Hair Expo Checkout — Architecture Rules

## Confirmed architecture

- Build a NestJS modular monolith.
- Use SQLite as the database.
- Enable SQLite WAL mode.
- Operate as one deployment for now.
- Add the frontend later; this repository currently defines the backend foundation.
- Keep Stripe/provider network calls outside database transactions.
- Use explicit application modules and replaceable interfaces for pricing and payment providers.

## In scope for the foundation

- Product catalog and immutable price-list versions.
- Orders with order-item price snapshots.
- Checkout intake using client-generated idempotency keys.
- Canonical request hashing.
- Safe duplicate-click and retry handling.
- A persisted checkout-operation state machine.
- Replaceable pricing-rule interfaces.
- Replaceable payment-provider interface.
- A fake payment provider for development and tests.
- Audit records.
- A structure for Stripe webhook-event deduplication.

## Explicitly out of scope

- Kafka and other event streaming infrastructure.
- Microservices or distributed deployment.
- Wallet ledger functionality.
- KYC.
- Settlement and reconciliation workflows.
- Frontend implementation.
- Business rules not present in the final assignment brief or CSV schema.

## Transaction and idempotency rules

- Database transactions are for local state changes only.
- Never call Stripe or another payment provider while holding a database transaction.
- A checkout request must persist its client idempotency key and canonical request hash.
- A repeated key with the same canonical request must return/reuse the original operation result.
- A repeated key with a different canonical request must be rejected as an idempotency conflict.
- Enforce idempotency uniqueness in SQLite, not only in application code.
- State transitions must be explicit, persisted, and guarded against invalid transitions.

## Data integrity rules

- Price-list versions and order-item price snapshots are immutable after use by an order.
- Money must be represented as integer minor units plus an explicit currency code; do not use floating point.
- Foreign keys must be enabled on every SQLite connection.
- Schema changes must be represented by migrations.
- Audit records should capture actor/source, action, entity identity, correlation/request identifiers, and a structured before/after or metadata payload where applicable.
- Webhook event IDs must be unique so Stripe event redelivery is harmless.

## Implementation discipline

- Do not infer unknown catalog, tax, discount, inventory, payment, or fulfillment rules.
- Keep domain policy behind interfaces and adapters so the final brief can define the rules later.
- Prefer deterministic, testable application services over controller-level business logic.
- Add tests for idempotency conflicts, duplicate retries, invalid state transitions, transaction boundaries, and webhook deduplication.
- Keep provider adapters thin; Stripe-specific code belongs in an infrastructure adapter.
