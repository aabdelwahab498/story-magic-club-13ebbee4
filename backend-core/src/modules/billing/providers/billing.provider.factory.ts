import { ConfigService } from '@nestjs/config';
import { MockProvider } from './mock.provider.js';
import { PaddleProvider } from './paddle.provider.js';
import { PaymentProvider } from './payment-provider.interface.js';
import type { Env } from '../../../config/env.config.js';

/**
 * Factory for selecting the appropriate PaymentProvider implementation based on configuration.
 * Enforces production fail-fast rules preventing mock payment usage in NODE_ENV=production.
 */
export const billingProviderFactory = (
  configService: ConfigService<Env, true>,
  paddleProvider: PaddleProvider,
  mockProvider: MockProvider,
): PaymentProvider => {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const provider = (
    configService.get<string>('PAYMENT_PROVIDER') || 'mock'
  ).toLowerCase();

  if (nodeEnv === 'production') {
    if (provider === 'mock') {
      throw new Error(
        'Mock payment provider is strictly forbidden in production (NODE_ENV=production).',
      );
    }
    const webhookSecret = configService.get<string>('PADDLE_WEBHOOK_SECRET');
    if (provider === 'paddle' && !webhookSecret) {
      throw new Error(
        'PADDLE_WEBHOOK_SECRET is required for paddle payment provider in production.',
      );
    }
  }

  switch (provider) {
    case 'paddle':
      return paddleProvider;
    case 'mock':
      return mockProvider;
    default:
      return nodeEnv === 'production' ? paddleProvider : mockProvider;
  }
};
