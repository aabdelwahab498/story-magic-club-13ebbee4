import { Injectable } from '@nestjs/common';
import { IMediaProvider } from './media-provider.interface.js';

@Injectable()
export class MockMediaProvider implements IMediaProvider {
  get name(): string {
    return 'mock-media-provider';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    storyId: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    // In a real provider, this might return an async tracking ID.
    // For the mock, we simulate an instant generation and return a fake URL.
    return `https://mock-storage.najmah.com/media/${storyId}-${Date.now()}.png`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async status(
    trackingId: string,
  ): Promise<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'> {
    // The mock is instantaneous
    return 'COMPLETED';
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cancel(trackingId: string): Promise<boolean> {
    return true;
  }
}
