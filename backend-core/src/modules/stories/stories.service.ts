import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { StoriesRepository } from './repositories/stories.repository.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { CreateStoryRequestDto } from './dto/create-story-request.dto.js';
import { StoryMetadata } from './interfaces/story-metadata.interface.js';
import { StoryStatus } from './enums/story-status.enum.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { GeneratedStory } from '../ai/interfaces/generated-story.interface.js';
import { StoryResponseDto } from './dto/story-response.dto.js';
import { ChildrenService } from '../children/children.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import {
  CREDIT_COSTS,
  TRANSACTION_TYPES,
  USAGE_EVENTS,
} from '../credits/credits.constants.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import type { JobDispatcher } from '../../common/jobs/job.interface.js';

@Injectable()
export class StoriesService {
  constructor(
    private readonly storiesRepository: StoriesRepository,
    private readonly aiContextService: ChildrenAIContextService,
    private readonly childrenService: ChildrenService,
    private readonly creditsService: CreditsService,
    private readonly usageService: UsageService,
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => StoryGenerationOrchestrator))
    private readonly orchestrator: StoryGenerationOrchestrator,
    @Inject('JobDispatcher')
    private readonly jobDispatcher: JobDispatcher,
  ) {}

  async createStory(
    user: UserContext,
    dto: CreateStoryRequestDto,
  ): Promise<StoryResponseDto> {
    // 0.1 Check feature access and plan limits in a consolidated call
    const sub = await this.subscriptionsService.getUserSubscription(user.id);
    if (!sub.features.includes('STORY_GENERATION')) {
      throw new Error('Feature STORY_GENERATION is not enabled for your plan.');
    }

    // 0.2 Check plan limits
    const limit = sub.limits['STORIES_PER_MONTH'];
    if (limit !== null && limit !== undefined) {
      const currentUsage = await this.subscriptionsService.getMonthlyUsage(
        user.id,
        'STORY_CREATED',
      );
      if (currentUsage >= limit) {
        throw new Error(
          `Plan limit reached: You have generated ${currentUsage} out of ${limit} stories this month.`,
        );
      }
    }

    // 0.3 Check credits
    const { balance } = await this.creditsService.getBalance(user.id);
    if (balance < CREDIT_COSTS.STORY_GENERATION) {
      throw new Error('Insufficient credits');
    }

    // 1. Validate child exists and belongs to the user
    await this.childrenService.getChild(user.id, dto.childId);

    // We could fetch actual reading level from aiContextService
    // For now we will fallback if not provided
    let readingLevel = dto.readingLevel;
    if (!readingLevel) {
      try {
        const context = await this.aiContextService.buildContext(
          user,
          dto.childId,
        );
        readingLevel = context.readingLevel || 'level_1';
      } catch {
        readingLevel = 'level_1'; // fallback
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
      throw new Error(jobResult.error || 'Story generation job failed');
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

    // Deduct credits and track usage
    await this.creditsService.consumeCredits(
      user.id,
      CREDIT_COSTS.STORY_GENERATION,
      TRANSACTION_TYPES.STORY_GENERATION,
      requestId,
    );
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
    const featureCheck = await this.subscriptionsService.canAccessFeature(
      user.id,
      'STORY_GENERATION',
    );
    if (!featureCheck.allowed) {
      throw new Error('Feature STORY_GENERATION is not enabled for your plan.');
    }

    return this.orchestrator.planStory(
      user,
      dto.childId,
      dto.language,
      dto.theme,
      dto.selGoal,
      dto.readingLevel,
      typeof dto.preferences?.customPrompt === 'string'
        ? dto.preferences.customPrompt
        : undefined,
    );
  }
}
