import { MockProvider } from './mock.provider.js';

/**
 * Factory for selecting the appropriate PaymentProvider implementation.
 * Currently supports only the mock provider. Extend to add real providers.
 */
export const billingProviderFactory = () => {
  const provider = process.env.PAYMENT_PROVIDER?.toLowerCase();
  switch (provider) {
    case 'mock':
    default:
      return new MockProvider();
  }
};
