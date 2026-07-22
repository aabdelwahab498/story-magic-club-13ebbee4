// backend-core/src/modules/media/audio.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { AudioProviderFactory } from './providers/audio/audio-provider.factory.js';
import { MetricsService } from '../metrics/metrics.service.js';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly providerFactory: AudioProviderFactory,
    private readonly metricsService: MetricsService,
  ) {}

  async generateNarration(storyId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Verify story exists
    const { data: story, error: storyError } = await supabase
      .from('ai_story_history')
      .select('id, pages, generated_story, language')
      .eq('id', storyId)
      .maybeSingle();

    if (storyError || !story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    // 2. Check if there's already a narration job
    const { data: existingMedia } = await supabase
      .from('story_media')
      .select('id, status')
      .eq('story_id', storyId)
      .eq('type', 'AUDIO')
      .maybeSingle();

    let mediaId: string;

    if (existingMedia) {
      if (['PENDING', 'PROCESSING'].includes(existingMedia.status)) {
        return { mediaId: existingMedia.id, status: existingMedia.status };
      }
      mediaId = existingMedia.id;
      await supabase
        .from('story_media')
        .update({ status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', mediaId);
    } else {
      // Create new story_media record
      const { data: newMedia, error: insertError } = await supabase
        .from('story_media')
        .insert({
          story_id: storyId,
          type: 'AUDIO',
          provider: this.providerFactory.getProvider().name,
          status: 'PENDING',
          metadata: {},
        })
        .select()
        .single();

      if (insertError || !newMedia) {
        throw new Error('Failed to create audio media request');
      }
      mediaId = newMedia.id;
    }

    // 3. Trigger fire-and-forget background generation
    void this.processAudioGeneration(mediaId, storyId, story);

    return {
      mediaId,
      status: 'PENDING',
    };
  }

  async getNarration(storyId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Check if the story exists and has a finalized audio URL
    const { data: story, error: storyError } = await supabase
      .from('ai_story_history')
      .select('audio_url')
      .eq('id', storyId)
      .maybeSingle();

    if (storyError || !story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    if (story.audio_url) {
      return {
        status: 'COMPLETED',
        audioUrl: story.audio_url,
      };
    }

    // Check story_media for the latest AUDIO record status
    const { data: media, error: mediaError } = await supabase
      .from('story_media')
      .select('status, metadata')
      .eq('story_id', storyId)
      .eq('type', 'AUDIO')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mediaError || !media) {
      return {
        status: 'NONE',
        audioUrl: null,
      };
    }

    return {
      status: media.status,
      audioUrl: null,
      error: media.status === 'FAILED' ? (media.metadata?.error || 'Audio generation failed') : null,
    };
  }

  async retryNarration(storyId: string) {
    return this.generateNarration(storyId);
  }

  async deleteNarration(storyId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Clear from ai_story_history
    await supabase
      .from('ai_story_history')
      .update({ audio_url: null, updated_at: new Date().toISOString() })
      .eq('id', storyId);

    // Delete story_media records for this story
    await supabase
      .from('story_media')
      .delete()
      .eq('story_id', storyId)
      .eq('type', 'AUDIO');

    return { success: true };
  }

  private async processAudioGeneration(mediaId: string, storyId: string, story: any) {
    const supabase = this.supabaseService.getAdminClient();
    try {
      await supabase
        .from('story_media')
        .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
        .eq('id', mediaId);

      // Extract and stitch pages text
      const pages = Array.isArray(story.pages) ? story.pages : [];
      let text = pages
        .map((p: any) => {
          if (typeof p === 'string') return p;
          return String(p.text || p.content || '').trim();
        })
        .filter(Boolean)
        .join(' ');

      if (!text) {
        const gs = story.generated_story as any;
        text = String(gs?.text || '').trim();
      }

      if (!text) {
        throw new Error('No text content available to generate narration.');
      }

      const language = story.language || 'en';
      const provider = this.providerFactory.getProvider();

      // Call the resolved provider to perform synthesis and measure duration
      const startTime = Date.now();
      let audioUrl: string;
      try {
        audioUrl = await provider.generate(storyId, { text, language });
      } finally {
        this.metricsService.observeFileProcessingDuration(
          (Date.now() - startTime) / 1000,
        );
      }

      // Update story_media to COMPLETED
      await supabase
        .from('story_media')
        .update({
          status: 'COMPLETED',
          url: audioUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mediaId);

      // Finalize the audio_url on the story history table
      await supabase
        .from('ai_story_history')
        .update({
          audio_url: audioUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyId);

    } catch (error: any) {
      this.logger.error(`Failed to generate audio for story ${storyId}`, error);

      await supabase
        .from('story_media')
        .update({
          status: 'FAILED',
          metadata: { error: error.message },
          updated_at: new Date().toISOString(),
        })
        .eq('id', mediaId);
    }
  }

  async synthesizeTts(text: string, language: string, character?: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase.functions.invoke('narrate-story', {
      body: { text, language, character },
    });

    if (error) {
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }

    return data;
  }
}
