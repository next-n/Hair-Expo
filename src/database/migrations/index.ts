import { initialMigration } from './001-initial';
import { checkoutOperationScopeMigration } from './002-checkout-operation-scope';

// Add each new migration here in ascending order.
export const migrations = [initialMigration, checkoutOperationScopeMigration];
