import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMediaProvider } from './media-provider.interface.js';
import { GoogleImageProvider } from './google-image.provider.js';
import { MockIllustrationProvider } from './mock-illustration.provider.js';

/**
 * Factory that returns the appropriate illustration provider based on configuration.
 * Enforces production fail-fast rules preventing mock illustration usage in NODE_ENV=production.
 */
@Injectable()
export class IllustrationProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleProvider: GoogleImageProvider,
    private readonly mockProvider: MockIllustrationProvider,
  ) {}

  getProvider(): IMediaProvider {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const providerName =
      this.configService.get<string>('ILLUSTRATION_PROVIDER') || 'google';

    if (nodeEnv === 'production') {
      if (providerName === 'mock') {
        throw new Error(
          'Mock illustration provider is strictly forbidden in production (NODE_ENV=production).',
        );
      }
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (providerName === 'google' && !apiKey) {
        throw new Error(
          'GOOGLE_API_KEY is missing for google illustration provider in production.',
        );
      }
    }

    switch (providerName) {
      case 'google':
        return this.googleProvider;
      case 'mock':
        return this.mockProvider;
      default:
        return nodeEnv === 'production'
          ? this.googleProvider
          : this.mockProvider;
    }
  }
}
