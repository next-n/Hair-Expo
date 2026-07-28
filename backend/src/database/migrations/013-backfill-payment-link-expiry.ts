import Database from 'better-sqlite3';
import { PRODUCTION_PAYMENT_LINK_TTL_MS } from '../../checkout-core/payment-link-expiry';
import { Migration } from './migration-runner';

type LegacyPaymentAttempt = {
  id: string;
  updatedAt: string;
};

/**
 * Apply the fixed production expiry policy to payment links created before
 * payment-link expiry columns were introduced.
 */
export const backfillPaymentLinkExpiryMigration: Migration = {
  id: '013-backfill-payment-link-expiry',
  up: (db: Database.Database) => {
    const legacyAttempts = db.prepare(`
      SELECT ca.id, ca.updated_at AS updatedAt
      FROM checkout_attempts ca
      JOIN checkout_operations co ON co.id = ca.checkout_operation_id
      JOIN orders o ON o.id = co.order_id
      WHERE o.status IN ('pending', 'review_required')
        AND ca.status = 'completed'
        AND ca.checkout_url IS NOT NULL
        AND ca.payment_link_created_at IS NULL
        AND ca.payment_link_expires_at IS NULL
    `).all() as LegacyPaymentAttempt[];

    const update = db.prepare(`
      UPDATE checkout_attempts
      SET payment_link_created_at = ?, payment_link_expires_at = ?
      WHERE id = ? AND payment_link_created_at IS NULL AND payment_link_expires_at IS NULL
    `);

    db.transaction(() => {
      for (const attempt of legacyAttempts) {
        const createdAt = new Date(attempt.updatedAt);
        if (Number.isNaN(createdAt.getTime())) throw new Error(`Invalid legacy payment attempt timestamp: ${attempt.id}`);
        update.run(createdAt.toISOString(), new Date(createdAt.getTime() + PRODUCTION_PAYMENT_LINK_TTL_MS).toISOString(), attempt.id);
      }
    })();
  },
};
