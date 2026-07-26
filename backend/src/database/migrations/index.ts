import { initialMigration } from './001-initial';
import { checkoutOperationScopeMigration } from './002-checkout-operation-scope';
import { checkoutProcessingMigration } from './003-checkout-processing';
import { mockVerticalSchemaMigration } from './004-mock-vertical-schema';
import { operationStatusConstraintMigration } from './005-operation-status-constraint';
import { pricingVersionMigration } from './006-pricing-version';
import { catalogFixturesMigration } from './007-catalog-fixtures';

// Add each new migration here in ascending order.
export const migrations = [initialMigration, checkoutOperationScopeMigration, checkoutProcessingMigration, mockVerticalSchemaMigration, operationStatusConstraintMigration, pricingVersionMigration, catalogFixturesMigration];
