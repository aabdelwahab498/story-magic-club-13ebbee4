// backend-core/src/modules/media/providers/audio/edge-audio.provider.ts
import { Injectable } from '@nestjs/common';
import { IAudioProvider } from './audio-provider.interface.js';
import { SupabaseService } from '../../../../supabase/supabase.service.js';

@Injectable()
export class EdgeAudioProvider implements IAudioProvider {
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
    },
  ): Promise<string> {
    const client = this.supabaseService.getAdminClient();

    const { data, error } = await client.functions.invoke('narrate-story-edge', {
      body: {
        text: metadata.text,
        language: metadata.language,
        voice: metadata.voice,
        storyId,
      },
    });

    if (error) {
      throw new Error(`Edge function narration failed: ${error.message}`);
    }

    if (!data || data.success !== true) {
      throw new Error(data?.message || 'Edge function returned failure');
    }

    return data.audioUrl;
  }
}
