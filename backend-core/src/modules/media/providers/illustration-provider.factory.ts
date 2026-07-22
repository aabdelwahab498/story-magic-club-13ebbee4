// backend-core/src/modules/media/providers/illustration-provider.factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMediaProvider } from './media-provider.interface.js';
import { GoogleImageProvider } from './google-image.provider.js';
import { MockIllustrationProvider } from './mock-illustration.provider.js';

/**
 * Factory that returns the appropriate illustration provider based on configuration.
 * Supports extensibility for additional providers without changing business logic.
 */
@Injectable()
export class IllustrationProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleProvider: GoogleImageProvider,
    private readonly mockProvider: MockIllustrationProvider,
  ) {}

  getProvider(): IMediaProvider {
    const providerName = this.configService.get<string>('ILLUSTRATION_PROVIDER') || 'google';
    switch (providerName) {
      case 'google':
        return this.googleProvider;
      case 'mock':
      default:
        return this.mockProvider;
    }
  }
}
