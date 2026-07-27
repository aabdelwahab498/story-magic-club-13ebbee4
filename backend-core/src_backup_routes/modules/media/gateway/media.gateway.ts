import { Injectable, Logger } from '@nestjs/common';
import { IMediaProvider } from '../providers/media-provider.interface.js';
import { MockMediaProvider } from '../providers/mock-media.provider.js';

export type MediaType = 'ILLUSTRATION' | 'AUDIO' | 'PDF';

@Injectable()
export class MediaGateway {
  private readonly logger = new Logger(MediaGateway.name);

  constructor(private readonly mockProvider: MockMediaProvider) {}

  /**
   * Routes the media generation request to the appropriate provider.
   */
  async generateMedia(
    requestId: string,
    storyId: string,
    type: MediaType,
    metadata?: Record<string, any>,
  ): Promise<string> {
    const startTime = Date.now();
    this.logger.log(`[REQ:${requestId}] Initiating media generation`, {
      storyId,
      type,
    });

    let provider: IMediaProvider;

    // Future enhancement: Switch based on type and config.
    // For now, route everything to the mock provider.
    switch (type) {
      case 'ILLUSTRATION':
      case 'AUDIO':
      case 'PDF':
      default:
        provider = this.mockProvider;
        break;
    }

    try {
      const url = await provider.generate(storyId, metadata);
      const duration = Date.now() - startTime;

      this.logger.log(`[REQ:${requestId}] Media generation completed`, {
        storyId,
        type,
        provider: provider.name,
        duration,
        status: 'COMPLETED',
      });

      return url;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`[REQ:${requestId}] Media generation failed`, {
        storyId,
        type,
        provider: provider.name,
        duration,
        status: 'FAILED',
        error: error.message,
      });
      throw error;
    }
  }
}
