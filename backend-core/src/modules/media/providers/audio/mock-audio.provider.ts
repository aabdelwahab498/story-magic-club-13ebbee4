// backend-core/src/modules/media/providers/audio/mock-audio.provider.ts
import { Injectable } from '@nestjs/common';
import { IAudioProvider } from './audio-provider.interface.js';

@Injectable()
export class MockAudioProvider implements IAudioProvider {
  get name(): string {
    return 'mock-audio';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    storyId: string,
    metadata: {
      text: string;
      language: string;
      voice?: string;
    },
  ): Promise<string> {
    // Return a short silent MP3 placeholder URL
    return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  }
}
