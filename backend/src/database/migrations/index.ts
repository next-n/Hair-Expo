import { initialMigration } from './001-initial';
import { checkoutOperationScopeMigration } from './002-checkout-operation-scope';
import { checkoutProcessingMigration } from './003-checkout-processing';
import { mockVerticalSchemaMigration } from './004-mock-vertical-schema';
import { operationStatusConstraintMigration } from './005-operation-status-constraint';
import { pricingVersionMigration } from './006-pricing-version';
import { catalogFixturesMigration } from './007-catalog-fixtures';
import { realCatalogSchemaMigration } from './008-real-catalog-schema';
import { finalOrderSnapshotMigration } from './009-final-order-snapshot';
import { paymentHardeningMigration } from './010-payment-hardening';
import { processingClaimTokenMigration } from './011-processing-claim-token';
import { orderRecreationAndPaymentExpiryMigration } from './012-order-recreation-and-payment-expiry';

// Add each new migration here in ascending order.
export const migrations = [initialMigration, checkoutOperationScopeMigration, checkoutProcessingMigration, mockVerticalSchemaMigration, operationStatusConstraintMigration, pricingVersionMigration, catalogFixturesMigration, realCatalogSchemaMigration, finalOrderSnapshotMigration, paymentHardeningMigration, processingClaimTokenMigration, orderRecreationAndPaymentExpiryMigration];
