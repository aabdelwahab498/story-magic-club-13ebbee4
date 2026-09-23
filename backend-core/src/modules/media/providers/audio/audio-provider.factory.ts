import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAudioProvider } from './audio-provider.interface.js';
import { EdgeAudioProvider } from './edge-audio.provider.js';
import { MockAudioProvider } from './mock-audio.provider.js';

@Injectable()
export class AudioProviderFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly edgeProvider: EdgeAudioProvider,
    private readonly mockProvider: MockAudioProvider,
  ) {}

  getProvider(): IAudioProvider {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const providerName =
      this.configService.get<string>('AUDIO_PROVIDER') || 'edge';

    if (nodeEnv === 'production' && providerName === 'mock') {
      throw new Error(
        'Mock audio provider is strictly forbidden in production (NODE_ENV=production).',
      );
    }

    switch (providerName) {
      case 'edge':
        return this.edgeProvider;
      case 'mock':
        return this.mockProvider;
      default:
        return nodeEnv === 'production'
          ? this.edgeProvider
          : this.mockProvider;
    }
  }
}
