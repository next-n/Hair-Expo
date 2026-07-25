export interface PaymentProviderRequest {
  readonly paymentAttemptId: string;
  readonly providerIdempotencyKey: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PaymentProviderResult {
  readonly status: 'created' | 'failed';
  readonly providerReference?: string;
  readonly checkoutUrl?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
