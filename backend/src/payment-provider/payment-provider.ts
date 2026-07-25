export interface CreateCheckoutInput {
  readonly paymentAttemptId: string;
  readonly providerIdempotencyKey: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface CheckoutResult {
  readonly status: 'created' | 'failed';
  readonly providerReference?: string;
  readonly checkoutUrl?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  retrieveCheckout(reference: string): Promise<CheckoutResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
