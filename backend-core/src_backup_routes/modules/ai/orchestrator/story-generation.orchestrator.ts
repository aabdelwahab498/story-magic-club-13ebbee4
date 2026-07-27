import { forwardRef, Injectable, Logger, Inject } from '@nestjs/common';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { StoriesService } from '../../stories/stories.service.js';
import { ChildrenService } from '../../children/children.service.js';
import { StoryStatus } from '../../stories/enums/story-status.enum.js';
import { AI_GATEWAY } from '../gateway/ai-gateway.interface.js';
import type { IAIGateway } from '../gateway/ai-gateway.interface.js';
import { GeneratedStory } from '@najmah/shared';
import { AIValidationException } from '../exceptions/ai.exceptions.js';
import { StoryLifecycleManager } from '../../stories/lifecycle/story-lifecycle.manager.js';
import { StoryMetricsService } from '../../stories/lifecycle/story-metrics.service.js';

@Injectable()
export class StoryGenerationOrchestrator {
  private readonly logger = new Logger(StoryGenerationOrchestrator.name);

  constructor(
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
    private readonly childrenService: ChildrenService,
    @Inject(AI_GATEWAY) private readonly aiGateway: IAIGateway,
    @Inject(forwardRef(() => StoryLifecycleManager))
    private readonly lifecycleManager: StoryLifecycleManager,
    private readonly metricsService: StoryMetricsService,
  ) {}

  /**
   * Orchestrates the entire story generation pipeline.
   * Throws exceptions if the generation fails.
   */
  async generateStory(
    user: UserContext,
    requestId: string,
  ): Promise<GeneratedStory> {
    const startTime = Date.now();
    this.metricsService.recordGenerationStarted();

    let childId = '';

    try {
      this.logger.log(`Starting generation for request: ${requestId}`);

      // Step 1: Retrieve request and mark QUEUED
      const request = await this.storiesService.getStoryById(user, requestId);
      childId = request.childId;

      await this.lifecycleManager.transitionStatus(
        user,
        requestId,
        request.status,
        StoryStatus.QUEUED,
      );
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'QUEUED',
        0,
      );

      // Step 2: Fetch Child to get age, and build AI context
      const child = await this.childrenService.getChild(user.id, childId);

      await this.lifecycleManager.transitionStatus(
        user,
        requestId,
        StoryStatus.QUEUED,
        StoryStatus.GENERATING,
      );
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'BUILDING_CONTEXT',
        5,
      );

      const storyContext = this.aiGateway.buildContext(
        child.age,
        request.language,
        request.theme,
        request.selGoal,
        request.readingLevel,
      );

      // Step 3: Planner
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'PLANNER',
        20,
      );
      const plannerStart = Date.now();
      const blueprint = await this.aiGateway.planStory(
        child.age,
        request.language,
        request.theme,
        request.selGoal,
        request.readingLevel,
      );
      this.metricsService.recordStageDuration(
        'planner',
        Date.now() - plannerStart,
      );

      // Step 4: Writer
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'WRITER',
        50,
      );
      const writerStart = Date.now();
      const generatedStory = await this.aiGateway.writeStory(
        storyContext,
        blueprint,
      );
      this.metricsService.recordStageDuration(
        'writer',
        Date.now() - writerStart,
      );

      // Step 5: Validator
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'VALIDATION',
        80,
      );
      const validatorStart = Date.now();
      const validationResult = this.aiGateway.validateStory(
        generatedStory,
        storyContext,
      );
      this.metricsService.recordStageDuration(
        'validator',
        Date.now() - validatorStart,
      );

      if (!validationResult.valid) {
        throw new AIValidationException(
          `Story validation failed: ${validationResult.errors.join(', ')}`,
          generatedStory,
        );
      }

      // Step 6: Persist generated story content
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'SAVING',
        95,
      );
      await this.storiesService.saveGeneratedStory(
        user,
        requestId,
        generatedStory,
      );

      // Step 7: Update status to GENERATED
      await this.lifecycleManager.transitionStatus(
        user,
        requestId,
        StoryStatus.GENERATING,
        StoryStatus.GENERATED,
      );
      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'COMPLETED',
        100,
      );

      this.metricsService.recordGenerationSuccess(Date.now() - startTime);
      return generatedStory;
    } catch (error) {
      this.metricsService.recordGenerationFailure();

      // Determine failure stage roughly
      const stage =
        error instanceof AIValidationException ? 'validator' : 'pipeline';

      this.lifecycleManager.recordFailure(
        user,
        requestId,
        childId, // Note: if it failed before child fetch, this will be empty, which is fine
        stage,
        error,
      );

      // Attempt to mark as FAILED
      try {
        const currentRequest = await this.storiesService.getStoryById(
          user,
          requestId,
        );
        await this.lifecycleManager.transitionStatus(
          user,
          requestId,
          currentRequest.status,
          StoryStatus.FAILED,
        );
      } catch (statusError) {
        this.logger.error(
          `Failed to update status to FAILED: ${(statusError as Error).message}`,
        );
      }

      throw error;
    }
  }

  /**
   * Runs only the planning phase of the SEL pipeline to generate a blueprint.
   */
  async planStory(
    user: UserContext,
    childId: string,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel?: string,
  ): Promise<any> {
    const child = await this.childrenService.getChild(user.id, childId);
    const level = readingLevel || 'level_1';
    return this.aiGateway.planStory(
      child.age,
      language,
      theme,
      selGoal,
      level,
    );
  }
}
