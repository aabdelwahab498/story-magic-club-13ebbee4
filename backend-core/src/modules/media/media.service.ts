import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
  Optional,
  Inject,
} from '@nestjs/common';
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
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import { IllustrationProviderFactory } from './providers/illustration-provider.factory.js';

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
    @Optional()
    @Inject(IllustrationProviderFactory)
    private readonly illustrationProviderFactory?: IllustrationProviderFactory,
  ) {}

  private resolveUser(userOrId: UserContext | string | undefined): {
    userId: string;
    isAdmin: boolean;
  } {
    if (!userOrId) {
      return { userId: '', isAdmin: false };
    }
    if (typeof userOrId === 'string') {
      return { userId: userOrId, isAdmin: false };
    }
    const roles = userOrId.roles || (userOrId.role ? [userOrId.role] : []);
    const isAdmin =
      roles.includes(Role.ADMIN) ||
      roles.includes(Role.SUPER_ADMIN) ||
      roles.includes('admin' as Role) ||
      roles.includes('super_admin' as Role);
    return { userId: userOrId.id, isAdmin };
  }

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

    // 1. Verify story exists via story_requests or ai_story_history
    const supabase = this.supabaseService.getUserClient();
    let exists = false;

    const { data: reqData } = await supabase
      .from('story_requests')
      .select('id')
      .eq('id', storyId)
      .maybeSingle();

    if (reqData) {
      exists = true;
    } else {
      const { data: histStory } = await supabase
        .from('ai_story_history')
        .select('id')
        .eq('id', storyId)
        .maybeSingle();
      if (histStory) exists = true;
    }

    if (!exists) {
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
    const supabase = this.supabaseService.getUserClient();
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
    const supabase = this.supabaseService.getUserClient();
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

  async createIllustrationJob(
    storyId: string,
    userOrId: UserContext | string,
  ) {
    const { userId, isAdmin } = this.resolveUser(userOrId);
    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Creating illustration job for story ${storyId} (user: ${userId}, isAdmin: ${isAdmin})`,
    );

    // 1. Verify story exists and user owns it (STILL ENFORCED FOR ALL USERS)
    await this.verifyStoryOwnership(storyId, userId);

    // 1.5. IDEMPOTENCY CHECK: Check if illustration job already exists for this story
    const existingMedia = (await this.getMediaForStory(storyId)) || [];
    const existingIllustrationJob = existingMedia.find(
      (m) => m && m.type === 'ILLUSTRATION',
    );
    if (existingIllustrationJob) {
      if (
        ['PENDING', 'PROCESSING', 'COMPLETED'].includes(
          existingIllustrationJob.status,
        )
      ) {
        this.logger.log(
          `[REQ:${requestId}] Illustration job already exists for story ${storyId} with status ${existingIllustrationJob.status}. Skipping duplicate creation.`,
        );
        return {
          storyId,
          status:
            existingIllustrationJob.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'GENERATING',
        };
      }

      if (existingIllustrationJob.status === 'FAILED') {
        this.logger.log(
          `[REQ:${requestId}] Existing illustration job for story ${storyId} is FAILED. Reusing record ${existingIllustrationJob.id} without double-charging.`,
        );
        const supabase = this.supabaseService.getUserClient();
        await supabase
          .from('story_media')
          .update({ status: 'PENDING' })
          .eq('id', existingIllustrationJob.id);

        void this.processMediaGeneration(
          requestId,
          existingIllustrationJob.id,
          storyId,
          'ILLUSTRATION',
          {
            ...(existingIllustrationJob.metadata as Record<string, any>),
            retryFailedOnly: true,
          },
        );

        return {
          storyId,
          status: 'GENERATING',
        };
      }
    }

    if (!isAdmin) {
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
        throw new HttpException(
          {
            code: 'INSUFFICIENT_ILLUSTRATION_CREDITS',
            message: 'Insufficient illustration credits',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    } else {
      this.logger.log(
        `[REQ:${requestId}] Admin entitlement bypass active for user ${userId} — bypassing feature/limit/credit checks`,
      );
    }

    // 2. Create story_media record
    const supabase = this.supabaseService.getUserClient();
    let providerName = 'google';
    try {
      if (this.illustrationProviderFactory) {
        providerName = this.illustrationProviderFactory.getProvider().name;
      }
    } catch {
      providerName = 'google';
    }

    const { data: mediaRecord, error: insertError } = await supabase
      .from('story_media')
      .insert({
        story_id: storyId,
        type: 'ILLUSTRATION',
        provider: providerName,
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
      throw new HttpException(
        {
          code: 'MEDIA_GENERATION_FAILED',
          message: `Failed to create illustration job: ${insertError?.message || 'Insert failed'}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Deduct credits only for non-admin users
    if (!isAdmin) {
      await this.creditsService.consumeCredits(
        userId,
        CREDIT_COSTS.ILLUSTRATION_GENERATION,
        TRANSACTION_TYPES.ILLUSTRATION_GENERATION,
        mediaRecord.id,
      );
    }

    this.usageService.trackUsage(
      userId,
      USAGE_EVENTS.ILLUSTRATION_JOB_STARTED,
      mediaRecord.id,
    );

    // 3. Call IllustrationService (fire-and-forget for MVP)
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

  private async verifyStoryOwnership(storyId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getUserClient();

    // 1. Check story_requests table
    const { data: requestStory } = await supabase
      .from('story_requests')
      .select('id, user_id')
      .eq('id', storyId)
      .maybeSingle();

    if (requestStory) {
      if (requestStory.user_id !== userId) {
        throw new NotFoundException(`Story with ID ${storyId} not found`);
      }
      return;
    }

    // 2. Check ai_story_history table
    const { data: legacyStory } = await supabase
      .from('ai_story_history')
      .select('id, user_id')
      .eq('id', storyId)
      .maybeSingle();

    if (legacyStory) {
      if (legacyStory.user_id && legacyStory.user_id !== userId) {
        throw new NotFoundException(`Story with ID ${storyId} not found`);
      }
      return;
    }

    throw new NotFoundException(`Story with ID ${storyId} not found`);
  }

  async retryIllustrationJob(
    storyId: string,
    userOrId?: UserContext | string,
  ) {
    const { userId } = this.resolveUser(userOrId);
    if (userId) {
      await this.verifyStoryOwnership(storyId, userId);
    }

    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Retrying failed illustrations for story ${storyId}`,
    );

    const supabase = this.supabaseService.getUserClient();

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
    userOrId: UserContext | string,
  ) {
    const { userId, isAdmin } = this.resolveUser(userOrId);
    if (userId) {
      await this.verifyStoryOwnership(storyId, userId);
    }

    if (!isAdmin) {
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
    } else {
      this.logger.log(
        `Admin entitlement bypass active for page regeneration by user ${userId}`,
      );
    }

    const requestId = randomUUID();
    this.logger.log(
      `[REQ:${requestId}] Regenerating illustration for story ${storyId} page ${pageNumber}`,
    );

    const supabase = this.supabaseService.getUserClient();

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

  async getIllustrations(storyId: string, userId?: string) {
    if (userId) {
      await this.verifyStoryOwnership(storyId, userId);
    }

    const allMedia = await this.getMediaForStory(storyId);
    const illustrationJob = allMedia.find((m) => m.type === 'ILLUSTRATION');

    if (!illustrationJob) {
      return {
        storyId,
        jobStatus: 'NONE',
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: [],
      };
    }

    const metadata = illustrationJob.metadata;
    const rawPages = metadata?.pages || [];
    const illustrations = rawPages.map((p: any) => ({
      pageNumber: p.pageNumber,
      imageUrl: p.imageUrl || null,
      status: p.status || (p.imageUrl ? 'COMPLETED' : 'FAILED'),
    }));

    // Legacy fallback for records created during MVP
    if (metadata?.illustration && illustrations.length === 0) {
      illustrations.push({
        pageNumber: metadata.illustration.pageNumber,
        imageUrl: illustrationJob.url,
        status: illustrationJob.status,
      });
    }

    const completedPages =
      metadata?.completedPages !== undefined
        ? metadata.completedPages
        : illustrations.filter((p: any) => p.status === 'COMPLETED').length;

    const failedPages =
      metadata?.failedPages !== undefined
        ? metadata.failedPages
        : illustrations.filter((p: any) => p.status === 'FAILED').length;

    return {
      storyId,
      jobStatus: illustrationJob.status,
      totalPages: metadata?.totalPages || illustrations.length,
      completedPages,
      failedPages,
      illustrations,
    };
  }

  async getMediaStatus(mediaId: string) {
    const supabase = this.supabaseService.getUserClient();
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
