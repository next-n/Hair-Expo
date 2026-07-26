import Database from 'better-sqlite3';
import { Migration } from './migration-runner';

export const finalOrderSnapshotMigration: Migration = {
  id: '009-final-order-snapshot',
  up: (db: Database.Database) => db.exec(`
    ALTER TABLE orders ADD COLUMN customer_name TEXT;
    ALTER TABLE orders ADD COLUMN customer_contact TEXT;
    ALTER TABLE orders ADD COLUMN total_weight_grams INTEGER NOT NULL DEFAULT 0 CHECK (total_weight_grams >= 0);
    ALTER TABLE orders ADD COLUMN subtotal_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_amount_minor >= 0);
    ALTER TABLE orders ADD COLUMN surcharge_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (surcharge_amount_minor >= 0);
    ALTER TABLE orders ADD COLUMN discount_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0);
    ALTER TABLE orders ADD COLUMN subtotal_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cny_minor >= 0);
    ALTER TABLE orders ADD COLUMN surcharge_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (surcharge_cny_minor >= 0);
    ALTER TABLE orders ADD COLUMN discount_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_cny_minor >= 0);
    ALTER TABLE orders ADD COLUMN total_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_cny_minor >= 0);
    ALTER TABLE orders ADD COLUMN selected_discount_reason TEXT;
    ALTER TABLE orders ADD COLUMN stripe_product_id TEXT;
    ALTER TABLE orders ADD COLUMN stripe_price_id TEXT;
    ALTER TABLE orders ADD COLUMN stripe_payment_link_id TEXT;
    ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;
    ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
    ALTER TABLE order_items ADD COLUMN line TEXT;
    ALTER TABLE order_items ADD COLUMN product_type TEXT;
    ALTER TABLE order_items ADD COLUMN length_in TEXT;
    ALTER TABLE order_items ADD COLUMN unit TEXT;
    ALTER TABLE order_items ADD COLUMN weight_contribution_grams INTEGER NOT NULL DEFAULT 0 CHECK (weight_contribution_grams >= 0);
    ALTER TABLE order_items ADD COLUMN blonde INTEGER NOT NULL DEFAULT 0 CHECK (blonde IN (0, 1));
    ALTER TABLE order_items ADD COLUMN base_unit_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (base_unit_amount_minor >= 0);
    ALTER TABLE order_items ADD COLUMN base_unit_amount_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (base_unit_amount_cny_minor >= 0);
    ALTER TABLE order_items ADD COLUMN adjusted_unit_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (adjusted_unit_amount_minor >= 0);
    ALTER TABLE order_items ADD COLUMN adjusted_unit_amount_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (adjusted_unit_amount_cny_minor >= 0);
    ALTER TABLE order_items ADD COLUMN line_total_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_total_cny_minor >= 0);
    ALTER TABLE pricing_adjustments ADD COLUMN amount_cny_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_cny_minor >= 0);
    ALTER TABLE checkout_attempts ADD COLUMN stripe_product_id TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN stripe_price_id TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN stripe_payment_link_id TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN stripe_checkout_session_id TEXT;
    ALTER TABLE checkout_attempts ADD COLUMN stripe_payment_intent_id TEXT;
    ALTER TABLE processed_webhook_events ADD COLUMN checkout_session_id TEXT;
    ALTER TABLE processed_webhook_events ADD COLUMN payment_intent_id TEXT;
    ALTER TABLE processed_webhook_events ADD COLUMN payment_link_id TEXT;
    ALTER TABLE processed_webhook_events ADD COLUMN payment_status TEXT;
  `),
};
