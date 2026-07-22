import { Injectable } from '@nestjs/common';
import { IMediaProvider } from './media-provider.interface.js';
import { StructuredPrompt } from '../illustration/types/illustration.types.js';

@Injectable()
export class MockIllustrationProvider implements IMediaProvider {
  get name(): string {
    return 'mock-illustration-provider';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    storyId: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return `https://mock-storage.najmah.com/media/${storyId}-${Date.now()}.png`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async generateIllustration(
    prompt: StructuredPrompt,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }> {
    return {
      url: `https://mock-storage.najmah.com/illustrations/mock-${Date.now()}.png`,
      provider: this.name,
      metadata: {
        usedPrompt: prompt,
        originalMetadata: metadata,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async status(
    trackingId: string,
  ): Promise<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'> {
    return 'COMPLETED';
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cancel(trackingId: string): Promise<boolean> {
    return true;
  }
}
