import { Injectable, Logger } from '@nestjs/common';
import { IAudioProvider } from './audio-provider.interface.js';
import { SupabaseService } from '../../../../supabase/supabase.service.js';
import { CircuitBreaker } from '../../../../common/resilience/circuit-breaker.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../../common/resilience/provider-error.classifier.js';

import { RequestContext } from '../../../../common/middleware/request-context.js';

@Injectable()
export class EdgeAudioProvider implements IAudioProvider {
  private readonly logger = new Logger(EdgeAudioProvider.name);
  private readonly timeoutMs = 20000;
  private readonly circuitBreaker = new CircuitBreaker('audio', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(private readonly supabaseService: SupabaseService) {}

  get name(): string {
    return 'edge';
  }

  async generate(
    storyId: string,
    metadata: {
      text: string;
      language: string;
      voice?: string;
      authToken?: string;
    },
  ): Promise<string> {
    return this.circuitBreaker.execute(() =>
      this.callEdgeFunction(storyId, metadata),
    );
  }

  private async callEdgeFunction(
    storyId: string,
    metadata: { text: string; language: string; voice?: string; authToken?: string },
  ): Promise<string> {
    const client = this.supabaseService.getAdminClient();
    const token = metadata.authToken || RequestContext.authToken;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const invokePromise = client.functions.invoke('narrate-story-edge', {
      body: {
        text: metadata.text,
        language: metadata.language,
        voice: metadata.voice,
        storyId,
      },
      headers,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Edge TTS timeout')), this.timeoutMs);
    });

    try {
      const { data, error } = (await Promise.race([
        invokePromise,
        timeoutPromise,
      ])) as any;

      if (error) {
        throw new Error(`Edge function narration failed: ${error.message}`);
      }

      if (!data || data.success !== true) {
        throw new Error(data?.message || 'Edge function returned failure');
      }

      return data.audioUrl;
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);

      this.logger.error(
        `EdgeAudioProvider failed [Category: ${classified.category}]: ${sanitizedMsg}`,
      );
      throw error;
    }
  }
}
