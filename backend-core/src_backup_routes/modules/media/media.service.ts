import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MediaGateway, MediaType } from './gateway/media.gateway.js';
import { randomUUID } from 'crypto';
import { IllustrationService } from './illustration/illustration.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import {
  CREDIT_COSTS,
  TRANSACTION_TYPES,
  USAGE_EVENTS,
} from '../credits/credits.constants.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mediaGateway: MediaGateway,
    private readonly illustrationService: IllustrationService,
    private readonly creditsService: CreditsService,
    private readonly usageService: UsageService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createMediaRequest(
    storyId: string,
    type: MediaType,
    metadata?: Record<string, any>,
  ) {
    const requestId = randomUUID();
    this.logger.log(`[REQ:${requestId}] Creating media request`, {
      storyId,
      type,
    });

    // 1. Verify story exists
    const supabase = this.supabaseService.getAdminClient();
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    // 2. Insert PENDING record into story_media
    const { data: mediaRecord, error: insertError } = await supabase
      .from('story_media')
      .insert({
        story_id: storyId,
        type,
        provider: 'mock-media-provider', // Will be dynamic later
        status: 'PENDING',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError || !mediaRecord) {
      this.logger.error(
        `[REQ:${requestId}] Failed to insert media record`,
        insertError,
      );
      throw new Error('Failed to create media request');
    }

    // 3. Fire-and-forget generation
    void this.processMediaGeneration(
      requestId,
      mediaRecord.id,
      storyId,
      type,
      metadata,
    );

    return {
      mediaId: mediaRecord.id,
      status: 'PENDING',
    };
  }

  private async processMediaGeneration(
    requestId: string,
    mediaId: string,
    storyId: string,
    type: MediaType,
    metadata?: Record<string, any>,
  ) {
    const supabase = this.supabaseService.getAdminClient();
    try {
      // Set to PROCESSING
      await supabase
        .from('story_media')
        .update({ status: 'PROCESSING' })
        .eq('id', mediaId);

      let url: string;
      if (type === 'ILLUSTRATION') {
        url = await this.illustrationService.generateIllustrations(
          storyId,
          mediaId,
          metadata,
        );
      } else {
        // Fallback or generic routing via Gateway
        url = await this.mediaGateway.generateMedia(
          requestId,
          storyId,
          type,
          metadata,
        );
        // Set to COMPLETED since generic gateway just returns URL
        await supabase
          .from('story_media')
          .update({ status: 'COMPLETED', url })
          .eq('id', mediaId);
      }
    } catch (error: any) {
      this.logger.error(
        `[REQ:${requestId}] Background generation failed`,
        error,
      );
      // Set to FAILED
      await supabase
        .from('story_media')
        .update({ status: 'FAILED' })
        .eq('id', mediaId);
    }
  }

  async getMediaForStory(storyId: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('story_media')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch media for story ${storyId}`);
    }

    return data;
  }

  async createIllustrationJob(storyId: string, userId: string) {
    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Creating illustration job for story ${storyId}`,
    );

    // -1. Check feature access
    const featureCheck = await this.subscriptionsService.canAccessFeature(
      userId,
      'ILLUSTRATION_GENERATION',
    );
    if (!featureCheck.allowed) {
      throw new Error(
        'Feature ILLUSTRATION_GENERATION is not enabled for your plan.',
      );
    }

    // -0.5. Check plan limits
    const limitCheck = await this.subscriptionsService.checkLimit(
      userId,
      'ILLUSTRATIONS_PER_MONTH',
    );
    if (!limitCheck.allowed) {
      throw new Error(
        `Plan limit reached: You have generated ${limitCheck.current} out of ${limitCheck.limit} illustrations this month.`,
      );
    }

    // 0. Check balance
    const { balance } = await this.creditsService.getBalance(userId);
    if (balance < CREDIT_COSTS.ILLUSTRATION_GENERATION) {
      throw new Error('Insufficient credits');
    }

    // 1. Verify story exists
    const supabase = this.supabaseService.getAdminClient();
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    // 2. Create story_media record
    const { data: mediaRecord, error: insertError } = await supabase
      .from('story_media')
      .insert({
        story_id: storyId,
        type: 'ILLUSTRATION',
        status: 'PENDING',
        metadata: {},
      })
      .select()
      .single();

    if (insertError || !mediaRecord) {
      this.logger.error(
        `[REQ:${requestId}] Failed to insert illustration record`,
        insertError,
      );
      throw new Error('Failed to create illustration job');
    }

    // Deduct credits and track usage before fire-and-forget
    await this.creditsService.consumeCredits(
      userId,
      CREDIT_COSTS.ILLUSTRATION_GENERATION,
      TRANSACTION_TYPES.ILLUSTRATION_GENERATION,
      mediaRecord.id,
    );
    this.usageService.trackUsage(
      userId,
      USAGE_EVENTS.ILLUSTRATION_JOB_STARTED,
      mediaRecord.id,
    );

    // 3. Call IllustrationService (fire-and-forget for MVP)
    // We reuse processMediaGeneration which already handles ILLUSTRATION type
    void this.processMediaGeneration(
      requestId,
      mediaRecord.id,
      storyId,
      'ILLUSTRATION',
      {},
    );

    return {
      storyId,
      status: 'GENERATING',
    };
  }

  async retryIllustrationJob(storyId: string) {
    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Retrying failed illustrations for story ${storyId}`,
    );

    const supabase = this.supabaseService.getAdminClient();

    // 1. Fetch existing illustration job
    const allMedia = await this.getMediaForStory(storyId);
    const illustrationJob = allMedia.find((m) => m.type === 'ILLUSTRATION');

    if (!illustrationJob) {
      throw new NotFoundException(
        `No illustration job found for story ${storyId}`,
      );
    }

    // 2. Set status back to PENDING so UI knows it is working
    const { error: updateError } = await supabase
      .from('story_media')
      .update({ status: 'PENDING' })
      .eq('id', illustrationJob.id);

    if (updateError) {
      this.logger.error(
        `[REQ:${requestId}] Failed to update status to PENDING for retry`,
        updateError,
      );
      throw new Error('Failed to start retry job');
    }

    // 3. Trigger generation with retry flag
    void this.processMediaGeneration(
      requestId,
      illustrationJob.id,
      storyId,
      'ILLUSTRATION',
      {
        ...(illustrationJob.metadata as Record<string, any>),
        retryFailedOnly: true,
      },
    );

    return {
      storyId,
      status: 'GENERATING',
    };
  }

  async regeneratePageIllustration(
    storyId: string,
    pageNumber: number,
    userId: string,
  ) {
    // Check feature access
    const featureCheck = await this.subscriptionsService.canAccessFeature(
      userId,
      'REGENERATE_ILLUSTRATION',
    );
    if (!featureCheck.allowed) {
      throw new Error(
        'Feature REGENERATE_ILLUSTRATION is not enabled for your plan.',
      );
    }

    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Regenerating illustration for story ${storyId} page ${pageNumber}`,
    );

    const supabase = this.supabaseService.getAdminClient();

    // 1. Fetch existing illustration job
    const allMedia = await this.getMediaForStory(storyId);
    const illustrationJob = allMedia.find((m) => m.type === 'ILLUSTRATION');

    if (!illustrationJob) {
      throw new NotFoundException(
        `No illustration job found for story ${storyId}`,
      );
    }

    // 2. Set status back to PENDING so UI knows it is working
    const { error: updateError } = await supabase
      .from('story_media')
      .update({ status: 'PENDING' })
      .eq('id', illustrationJob.id);

    if (updateError) {
      this.logger.error(
        `[REQ:${requestId}] Failed to update status to PENDING for regeneration`,
        updateError,
      );
      throw new Error('Failed to start regeneration job');
    }

    // 3. Trigger generation with regeneratePage flag
    void this.processMediaGeneration(
      requestId,
      illustrationJob.id,
      storyId,
      'ILLUSTRATION',
      {
        ...(illustrationJob.metadata as Record<string, any>),
        regeneratePage: pageNumber,
      },
    );

    return {
      storyId,
      status: 'GENERATING',
    };
  }

  async getIllustrations(storyId: string) {
    const allMedia = await this.getMediaForStory(storyId);
    const illustrationJob = allMedia.find((m) => m.type === 'ILLUSTRATION');

    if (!illustrationJob) {
      return {
        jobStatus: 'NONE',
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: [],
      };
    }

    const metadata = illustrationJob.metadata;
    const illustrations = metadata?.pages || [];

    // Legacy fallback for records created during MVP
    if (metadata?.illustration && illustrations.length === 0) {
      illustrations.push({
        pageNumber: metadata.illustration.pageNumber,
        imageUrl: illustrationJob.url,
        status: illustrationJob.status,
      });
    }

    return {
      jobStatus: illustrationJob.status,
      totalPages: metadata?.totalPages || illustrations.length,
      completedPages:
        metadata?.completedPages ||
        (illustrationJob.status === 'COMPLETED' ? 1 : 0),
      failedPages:
        metadata?.failedPages || (illustrationJob.status === 'FAILED' ? 1 : 0),
      illustrations,
    };
  }

  async getMediaStatus(mediaId: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('story_media')
      .select('status, url')
      .eq('id', mediaId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Media with ID ${mediaId} not found`);
    }

    return data;
  }
}
