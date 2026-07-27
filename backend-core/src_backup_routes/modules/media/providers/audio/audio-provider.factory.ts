// backend-core/src/modules/media/providers/audio/audio-provider.factory.ts
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
    const providerName =
      this.configService.get<string>('AUDIO_PROVIDER') || 'edge';

    switch (providerName) {
      case 'edge':
        return this.edgeProvider;
      case 'mock':
        return this.mockProvider;
      default:
        return this.edgeProvider;
    }
  }
}
