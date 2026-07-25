export interface PaymentProviderRequest {
  readonly paymentAttemptId: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PaymentProviderResult {
  readonly status: 'succeeded' | 'failed' | 'pending';
  readonly providerReference?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
}
