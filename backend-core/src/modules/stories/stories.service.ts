import { Injectable, Inject, forwardRef, Logger, HttpException, HttpStatus, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { StoriesRepository } from './repositories/stories.repository.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import { CreateStoryRequestDto } from './dto/create-story-request.dto.js';
import { CreateTrialStoryDto } from './dto/create-trial-story.dto.js';
import { TrialStoryResponseDto } from './dto/trial-story-response.dto.js';
import { StoryMetadata } from './interfaces/story-metadata.interface.js';
import { StoryStatus } from './enums/story-status.enum.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { GeneratedStory } from '../ai/interfaces/generated-story.interface.js';
import { StoryResponseDto } from './dto/story-response.dto.js';
import { ChildrenService } from '../children/children.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import { AI_GATEWAY } from '../ai/gateway/ai-gateway.interface.js';
import type { IAIGateway } from '../ai/gateway/ai-gateway.interface.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import {
  CREDIT_COSTS,
  TRANSACTION_TYPES,
  USAGE_EVENTS,
} from '../credits/credits.constants.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import type { JobDispatcher } from '../../common/jobs/job.interface.js';
import * as crypto from 'crypto';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);
  private readonly trialIpTracker = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly storiesRepository: StoriesRepository,
    private readonly aiContextService: ChildrenAIContextService,
    private readonly childrenService: ChildrenService,
    private readonly creditsService: CreditsService,
    private readonly usageService: UsageService,
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => StoryGenerationOrchestrator))
    private readonly orchestrator: StoryGenerationOrchestrator,
    @Inject(AI_GATEWAY)
    private readonly aiGateway: IAIGateway,
    @Inject('JobDispatcher')
    private readonly jobDispatcher: JobDispatcher,
  ) {}

  private isAdminUser(user: UserContext): boolean {
    if (!user) return false;
    const roles = user.roles || (user.role ? [user.role] : []);
    return (
      roles.includes(Role.ADMIN) ||
      roles.includes(Role.SUPER_ADMIN) ||
      roles.includes('admin' as Role) ||
      roles.includes('super_admin' as Role)
    );
  }

  async createStory(
    user: UserContext,
    dto: CreateStoryRequestDto,
  ): Promise<StoryResponseDto> {
    const isAdmin = this.isAdminUser(user);

    if (!isAdmin) {
      // 0.1 Check feature access
      const sub = await this.subscriptionsService.getUserSubscription(user.id);
      if (!sub.features.includes('STORY_GENERATION')) {
        throw new ForbiddenException('Feature STORY_GENERATION is not enabled for your plan.');
      }

      // 0.2 Check story quota via canonical checkStoryQuota
      const quota = await this.subscriptionsService.checkStoryQuota(user.id, user);
      if (!quota.allowed) {
        if (quota.reason === 'daily_limit_reached') {
          throw new HttpException(
            `Daily story limit reached (${quota.daily_used}/${quota.daily_limit}). Please try again tomorrow.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (quota.reason === 'monthly_limit_reached') {
          throw new HttpException(
            `Plan limit reached: You have generated ${quota.monthly_used} out of ${quota.monthly_limit} stories this month.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else {
          throw new ForbiddenException('Feature STORY_GENERATION is not enabled for your plan or quota exceeded.');
        }
      }
    } else {
      this.logger.log(
        `Admin story quota bypass active for user ${user.id} (${user.email}) — bypassing feature/quota checks`,
      );
    }

    // 1. Validate child exists and belongs to the user if childId is present; otherwise enforce explicit childName & age
    if (dto.childId) {
      const child = await this.childrenService.getChild(user.id, dto.childId);
      dto.childName = child.name;
      dto.age = child.age;
    } else {
      if (!dto.childName || typeof dto.age !== 'number') {
        throw new BadRequestException(
          'When childId is not provided, both childName and age must be explicitly supplied.',
        );
      }
    }

    // We could fetch actual reading level from aiContextService
    // For now we will fallback if not provided
    let readingLevel = dto.readingLevel;
    if (!readingLevel) {
      if (dto.childId) {
        try {
          const context = await this.aiContextService.buildContext(
            user,
            dto.childId,
          );
          readingLevel = context.readingLevel || 'level_1';
        } catch {
          readingLevel = 'level_1'; // fallback
        }
      } else {
        const ageVal = dto.age!;
        readingLevel = ageVal <= 5 ? 'level_1' : ageVal <= 8 ? 'level_2' : 'level_3';
      }
    }

    // 2. Create the story request
    const request = await this.storiesRepository.createRequest(
      user.id,
      dto,
      readingLevel,
    );

    // 3. Connect to the AI Pipeline via Job Abstraction
    const jobResult = await this.jobDispatcher.dispatch('story-generation', {
      user,
      requestId: request.id,
    });
    if (!jobResult.success) {
      throw new InternalServerErrorException(jobResult.error || 'Story generation job failed');
    }

    // 4. Return the fully populated story
    return this.getFullStoryById(user, request.id);
  }

  async getStoriesByChild(
    user: UserContext,
    childId: string,
  ): Promise<StoryMetadata[]> {
    return this.storiesRepository.findByChild(user.id, childId);
  }

  async getUserStories(user: UserContext): Promise<StoryMetadata[]> {
    return this.storiesRepository.findAllByUser(user.id);
  }

  async getStoryById(user: UserContext, id: string): Promise<StoryMetadata> {
    return this.storiesRepository.findById(user.id, id);
  }

  async getFullStoryById(
    user: UserContext,
    id: string,
  ): Promise<StoryResponseDto> {
    const { metadata, content } = await this.storiesRepository.getFullStory(
      user.id,
      id,
    );

    const {
      id: storyId,
      userId,
      childId,
      status,
      createdAt,
      updatedAt,
      ...metaProps
    } = metadata;

    const contentMeta = content?.metadata || {};
    const ageVal = metadata.age || contentMeta.age || 6;
    const ageBand =
      contentMeta.age_band ||
      (ageVal <= 5 ? '3-5' : ageVal <= 8 ? '6-8' : '9-12');

    const selOutcome = contentMeta.sel_outcome || {
      skill: metadata.selGoal || 'Empathy',
      emotion: 'calm',
      statement: `Learned about ${metadata.selGoal || 'growth'}.`,
    };

    const characterVisualHash =
      contentMeta.character_visual_hash ||
      crypto
        .createHash('sha256')
        .update((metadata.childName || 'Hero') + metadata.theme)
        .digest('hex')
        .substring(0, 16);

    return {
      id: storyId,
      userId,
      childId,
      status,
      createdAt,
      updatedAt,
      metadata: metaProps,
      title: content?.title,
      pages: content?.pages,

      // Enriched SEL Frontend Compatibility Fields
      story_id: storyId,
      sel_outcome: selOutcome,
      character_visual_hash: characterVisualHash,
      age_band: ageBand,
      quality: contentMeta.quality || {
        total: 20,
        passed: true,
        scores: {
          act_structure: 5,
          sel_integration: 5,
          vocabulary: 5,
          safety: 5,
        },
      },
      safety: contentMeta.safety || { passed: true, violations: [] },
      length: contentMeta.length || {
        passed: true,
        pageCount: content?.pages?.length || 5,
      },
      passed: contentMeta.passed !== undefined ? contentMeta.passed : true,
      regeneration_count: contentMeta.regeneration_count || 0,
      blueprint: contentMeta.blueprint || undefined,
    };
  }

  async updateStoryStatus(
    user: UserContext,
    id: string,
    status: StoryStatus,
  ): Promise<StoryMetadata> {
    return this.storiesRepository.updateStatus(user.id, id, status);
  }

  async saveGeneratedStory(
    user: UserContext,
    requestId: string,
    story: GeneratedStory,
  ): Promise<void> {
    await this.storiesRepository.saveGeneratedStory(user.id, requestId, story);

    // Deduct credits if user is non-admin and balance available, and track usage
    if (!this.isAdminUser(user)) {
      try {
        const { balance } = await this.creditsService.getBalance(user.id);
        if (balance > 0) {
          await this.creditsService.consumeCredits(
            user.id,
            CREDIT_COSTS.STORY_GENERATION,
            TRANSACTION_TYPES.STORY_GENERATION,
            requestId,
          );
        }
      } catch (e: any) {
        this.logger.debug(`Story credit deduction skipped: ${e.message}`);
      }
    } else {
      this.logger.log(`[CREDITS] Admin story credit debit bypassed for user ${user.id}`);
    }
    await this.usageService.trackUsage(
      user.id,
      USAGE_EVENTS.STORY_CREATED,
      requestId,
    );
  }

  async deleteStory(user: UserContext, id: string): Promise<boolean> {
    return this.storiesRepository.delete(user.id, id);
  }

  async retryStory(user: UserContext, id: string): Promise<StoryResponseDto> {
    // 1. Fetch the story
    const story = await this.storiesRepository.findById(user.id, id);
    if (story.status !== StoryStatus.FAILED) {
      throw new Error('Only failed stories can be retried');
    }

    // 2. Transition status to QUEUED
    await this.storiesRepository.updateStatus(user.id, id, StoryStatus.QUEUED);

    // 3. Trigger generation pipeline via Job Abstraction
    const jobResult = await this.jobDispatcher.dispatch('story-generation', {
      user,
      requestId: id,
    });
    if (!jobResult.success) {
      throw new Error(jobResult.error || 'Story retry job failed');
    }

    // 4. Return updated full story
    return this.getFullStoryById(user, id);
  }

  async planStory(
    user: UserContext,
    dto: CreateStoryRequestDto,
  ): Promise<any> {
    const isAdmin = this.isAdminUser(user);

    if (!isAdmin) {
      const featureCheck = await this.subscriptionsService.canAccessFeature(
        user.id,
        'STORY_GENERATION',
      );
      if (!featureCheck.allowed) {
        throw new Error('Feature STORY_GENERATION is not enabled for your plan.');
      }

      const quota = await this.subscriptionsService.checkStoryQuota(user.id, user);
      if (!quota.allowed) {
        if (quota.reason === 'daily_limit_reached') {
          throw new Error(
            `Daily story limit reached (${quota.daily_used}/${quota.daily_limit}). Please try again tomorrow.`,
          );
        } else if (quota.reason === 'monthly_limit_reached') {
          throw new Error(
            `Plan limit reached: You have generated ${quota.monthly_used} out of ${quota.monthly_limit} stories this month.`,
          );
        } else {
          throw new Error('Feature STORY_GENERATION is not enabled for your plan or quota exceeded.');
        }
      }
    } else {
      this.logger.log(
        `Admin story plan quota bypass active for user ${user.id} (${user.email}) — bypassing feature/quota checks`,
      );
    }

    return this.orchestrator.planStory(
      user,
      dto.childId || '',
      dto.language,
      dto.theme,
      dto.selGoal,
      dto.readingLevel,
    );
  }

  async createTrialStory(
    dto: CreateTrialStoryDto,
    clientIp = '127.0.0.1',
  ): Promise<TrialStoryResponseDto> {
    this.checkTrialRateLimit(clientIp);

    const requestId = crypto.randomUUID();
    this.logger.log(`[TRIAL_STORY_REQUESTED] Processing trial request ${requestId} for IP ${clientIp}`);

    const childName = dto.childName?.trim() || 'Hero';
    const age = dto.age;
    const theme = dto.theme.trim();
    const language = dto.language?.trim() || 'en';
    const selGoal = dto.selGoal?.trim() || 'Empathy & Courage';
    const readingLevel = age <= 5 ? 'level_1' : age <= 8 ? 'level_2' : 'level_3';

    try {
      // 1. Build context via AI Gateway
      const context = this.aiGateway.buildContext(
        age,
        language,
        theme,
        selGoal,
        readingLevel,
      );

      // 2. Plan story via AI Gateway
      const blueprint = await this.aiGateway.planStory(
        age,
        language,
        theme,
        selGoal,
        readingLevel,
      );

      // 3. Write story via AI Gateway
      const generatedStory = await this.aiGateway.writeStory(context, blueprint);

      // 4. Validate output via AI Gateway
      const validationResult = this.aiGateway.validateStory(
        generatedStory,
        context,
      );
      if (!validationResult.valid) {
        this.logger.warn(
          `[TRIAL_STORY_VALIDATION_WARNING] Request ${requestId} validation warnings: ${validationResult.errors.join(', ')}`,
        );
      }

      // 5. Format into 3-page teaser response
      const TRIAL_PAGES = 3;
      const teaserPages = (generatedStory.pages || [])
        .slice(0, TRIAL_PAGES)
        .map((p, idx) => ({
          index: p.pageNumber || idx + 1,
          text: p.text,
          emotionTag: (p as any).emotionTag || 'happy',
          illustrationPrompt:
            (p as any).illustrationPrompt || `${theme} scene for ${childName}`,
          imageUrl: null,
        }));

      this.logger.log(
        `[TRIAL_STORY_COMPLETED] Trial story ${requestId} completed successfully`,
      );

      return {
        requestId,
        teaser: true,
        title: generatedStory.title || `${childName}'s Adventure`,
        pages: teaserPages,
        totalPages: generatedStory.pages?.length || teaserPages.length,
        shownPages: teaserPages.length,
        sel_outcome: (blueprint as any).selOutcome || {
          skill: selGoal,
          emotion: 'inspired',
          statement: `${childName} learned about ${selGoal}.`,
        },
      };
    } catch (err: any) {
      this.logger.error(
        `[TRIAL_STORY_FAILED] Request ${requestId} failed: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  private checkTrialRateLimit(clientIp: string): void {
    const now = Date.now();
    const tracker = this.trialIpTracker.get(clientIp);

    if (!tracker || now > tracker.resetAt) {
      this.trialIpTracker.set(clientIp, { count: 1, resetAt: now + 60000 });
      return;
    }

    if (tracker.count >= 5) {
      this.logger.warn(`[TRIAL_RATE_LIMITED] IP ${clientIp} exceeded trial rate limit`);
      throw new HttpException(
        {
          error: 'TRIAL_RATE_LIMITED',
          message: 'Trial limit exceeded. Please wait a minute before requesting another story.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    tracker.count += 1;
  }
}
