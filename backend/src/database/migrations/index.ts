import { initialMigration } from './001-initial';
import { checkoutOperationScopeMigration } from './002-checkout-operation-scope';
import { checkoutProcessingMigration } from './003-checkout-processing';
import { mockVerticalSchemaMigration } from './004-mock-vertical-schema';

// Add each new migration here in ascending order.
export const migrations = [initialMigration, checkoutOperationScopeMigration, checkoutProcessingMigration, mockVerticalSchemaMigration];
