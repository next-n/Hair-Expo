const mockStripe = {
  paymentLinks: {
    retrieve: jest.fn(),
  },
  checkout: {
    sessions: {
      list: jest.fn(),
    },
  },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));

import { StripePaymentProvider } from '../src/payment-provider/stripe-payment-provider';

describe('Stripe payment provider manual refresh', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_manual_refresh';
    mockStripe.paymentLinks.retrieve.mockReset().mockResolvedValue({ id: 'plink_test', url: 'https://buy.stripe.test/plink_test', livemode: false });
    mockStripe.checkout.sessions.list.mockReset();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('selects an older paid session when a newer session is unpaid', async () => {
    mockStripe.checkout.sessions.list.mockResolvedValue({
      data: [
        { id: 'cs_new_unpaid', payment_status: 'unpaid', amount_total: 7650, currency: 'usd', payment_intent: null },
        { id: 'cs_old_paid', payment_status: 'paid', amount_total: 7650, currency: 'usd', payment_intent: 'pi_old_paid' },
      ],
    });

    const provider = new StripePaymentProvider();
    await expect(provider.retrieveCheckout('plink_test')).resolves.toMatchObject({
      status: 'created',
      checkoutSessionId: 'cs_old_paid',
      paymentIntentId: 'pi_old_paid',
      amountMinor: 7650,
      currency: 'USD',
      paymentLinkId: 'plink_test',
    });
    expect(mockStripe.checkout.sessions.list).toHaveBeenCalledWith({ payment_link: 'plink_test', limit: 10 });
  });

  it('keeps the newest session when no listed session is paid', async () => {
    mockStripe.checkout.sessions.list.mockResolvedValue({
      data: [{ id: 'cs_new_unpaid', payment_status: 'unpaid', amount_total: 7650, currency: 'usd', payment_intent: null }],
    });

    const provider = new StripePaymentProvider();
    await expect(provider.retrieveCheckout('plink_test')).resolves.toMatchObject({
      status: 'failed',
      checkoutSessionId: 'cs_new_unpaid',
    });
  });
});
