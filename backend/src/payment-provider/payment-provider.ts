export interface CreateCheckoutInput {
  readonly paymentAttemptId: string;
  readonly providerIdempotencyKey: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly orderId?: string;
  readonly orderNumber?: string;
  readonly operationId?: string;
  readonly frontendUrl?: string;
}

export interface CheckoutResult {
  readonly status: 'created' | 'failed';
  readonly providerReference?: string;
  readonly checkoutUrl?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly livemode?: boolean;
  readonly providerProductId?: string;
  readonly providerPriceId?: string;
  readonly paymentLinkId?: string;
  readonly checkoutSessionId?: string;
  readonly paymentIntentId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  retrieveCheckout(reference: string): Promise<CheckoutResult>;
  deactivateCheckout(reference: string): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
