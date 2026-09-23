import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { MediaService } from '../../media/media.service.js';
import { StoryDirectorService } from '../director/story-director.service.js';
import { StoryGuardianService } from '../director/story-guardian.service.js';

@Injectable()
export class StoryGenerationOrchestrator {
  private readonly logger = new Logger(StoryGenerationOrchestrator.name);

  constructor(
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
    private readonly childrenService: ChildrenService,
    @Inject(AI_GATEWAY) private readonly aiGateway: IAIGateway,
    private readonly lifecycleManager: StoryLifecycleManager,
    private readonly metricsService: StoryMetricsService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
    private readonly storyDirector: StoryDirectorService,
    private readonly storyGuardian: StoryGuardianService,
  ) {}

  /**
   * Orchestrates the entire story generation pipeline with Story Director contract enforcement
   * and Story Guardian bounded corrective validation loops.
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

      // Step 1: Retrieve request and update lifecycle status forward-only
      const request = await this.storiesService.getStoryById(user, requestId);
      childId = request.childId || '';

      let currentStatus = request.status;

      if (currentStatus === StoryStatus.DRAFT) {
        await this.lifecycleManager.transitionStatus(
          user,
          requestId,
          StoryStatus.DRAFT,
          StoryStatus.QUEUED,
        );
        currentStatus = StoryStatus.QUEUED;
        this.lifecycleManager.updateProgress(
          user,
          requestId,
          childId,
          'QUEUED',
          0,
        );
      }

      if (currentStatus === StoryStatus.QUEUED) {
        await this.lifecycleManager.transitionStatus(
          user,
          requestId,
          StoryStatus.QUEUED,
          StoryStatus.GENERATING,
        );
        currentStatus = StoryStatus.GENERATING;
      }

      // Step 2: Resolve Child age and name, and build AI context
      let childAge = request.age!;
      let childName = request.childName!;

      if (childId) {
        try {
          const child = await this.childrenService.getChild(user.id, childId);
          if (child) {
            childAge = child.age ?? childAge;
            childName = child.name ?? childName;
          }
        } catch {
          // Keep request age and childName if profile lookup fails
        }
      }

      this.lifecycleManager.updateProgress(
        user,
        requestId,
        childId,
        'BUILDING_CONTEXT',
        5,
      );

      const storyContext: any = this.aiGateway.buildContext(
        childAge,
        request.language,
        request.theme,
        request.selGoal,
        request.readingLevel,
      );
      storyContext.childName = childName;
      storyContext.emotionalFocus = request.emotionalFocus;
      storyContext.customPrompt = request.customPrompt;
      storyContext.presetBlueprint = request.presetBlueprint;
      storyContext.preferences = request.preferences;

      // Story Director: Derive StoryContract
      const contract = this.storyDirector.deriveContract(
        request.customPrompt,
        childName,
        childAge,
      );
      storyContext.contract = contract;

      let generatedStory: GeneratedStory | null = null;
      let blueprint: any = null;
      let lastValidationErrors: string[] = [];

      const maxAttempts = 3; // 1 initial + up to 2 retries
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Step 3: Planner (Reuse pre-planned blueprint if supplied on 1st attempt)
        this.lifecycleManager.updateProgress(
          user,
          requestId,
          childId,
          'PLANNER',
          20,
        );

        if (
          attempt === 1 &&
          storyContext.presetBlueprint &&
          Object.keys(storyContext.presetBlueprint).length > 0
        ) {
          this.logger.log(
            `[PRESET_BLUEPRINT] Reusing supplied blueprint for request ${requestId}`,
          );
          const pb = storyContext.presetBlueprint;
          blueprint = {
            title: pb.title || `${childName}'s Adventure`,
            characters: Array.isArray(pb.characters)
              ? pb.characters
              : [
                  {
                    name: pb.hero?.name || childName,
                    role: 'hero',
                    description: pb.hero?.sense || 'Hero',
                  },
                  {
                    name: pb.mentor?.name || 'Mentor',
                    role: 'mentor',
                    description: pb.mentor?.role || 'Mentor',
                  },
                  {
                    name: pb.companion?.name || 'Companion',
                    role: 'companion',
                    description: pb.companion?.role || 'Companion',
                  },
                ],
            conflict: pb.conflict || pb.acts?.act2_disturbance || request.theme,
            resolution: pb.resolution || pb.acts?.act4_resolution || request.selGoal,
            selGoals: Array.isArray(pb.selGoals)
              ? pb.selGoals
              : request.emotionalFocus?.length
                ? request.emotionalFocus
                : [request.selGoal],
            pageCount: pb.pageCount || request.pageCount || 5,
          };
        } else {
          const plannerStart = Date.now();
          blueprint = await this.aiGateway.planStory(
            childAge,
            request.language,
            request.theme,
            request.selGoal,
            request.readingLevel,
            storyContext,
          );
          this.metricsService.recordStageDuration(
            'planner',
            Date.now() - plannerStart,
          );
        }

        // Step 4: Writer
        this.lifecycleManager.updateProgress(
          user,
          requestId,
          childId,
          'WRITER',
          50,
        );
        const writerStart = Date.now();
        generatedStory = await this.aiGateway.writeStory(
          storyContext,
          blueprint,
        );
        this.metricsService.recordStageDuration(
          'writer',
          Date.now() - writerStart,
        );

        // Step 5: Validator & Story Guardian
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

        if (validationResult.valid) {
          // Success! Canonical story approved
          lastValidationErrors = [];
          break;
        }

        lastValidationErrors = validationResult.errors;
        this.logger.warn(
          `[STORY_GUARDIAN_REJECTED] Attempt ${attempt}/${maxAttempts} failed contract validation: ${validationResult.errors.join('; ')}`,
        );

        if (attempt < maxAttempts) {
          storyContext.correctionContext = `Previous attempt was rejected because: ${validationResult.errors.join('; ')}. You MUST strictly adhere to the primary brief (${storyContext.customPrompt}).`;
        }
      }

      if (!generatedStory || lastValidationErrors.length > 0) {
        throw new AIValidationException(
          `Story Guardian validation failed: ${lastValidationErrors.join(', ')}`,
          generatedStory || undefined,
        );
      }

      // Enrich generatedStory metadata before saving
      if (!generatedStory.metadata) {
        generatedStory.metadata = {
          theme: request.theme,
          selGoal: request.selGoal,
        };
      }
      const meta = generatedStory.metadata as Record<string, any>;
      meta.blueprint = blueprint;
      meta.emotionalFocus = request.emotionalFocus;
      meta.customPrompt = request.customPrompt;
      meta.childName = childName;
      meta.age = childAge;
      meta.contract = contract;
      meta.sel_outcome = (blueprint as any)?.selOutcome || {
        skill: request.selGoal,
        emotion: 'calm',
        statement: `${childName} learned about ${request.selGoal}.`,
      };

      // Step 6: Persist canonical generated story content
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

      // Auto-dispatch illustration generation (idempotent & user-context preserving)
      try {
        this.logger.log(`Auto-dispatching illustration job for story: ${requestId}`);
        await this.mediaService.createIllustrationJob(requestId, user);
      } catch (mediaError: any) {
        this.logger.warn(
          `Auto-dispatch illustration skipped/failed for story ${requestId}: ${mediaError.message}`,
        );
      }

      this.metricsService.recordGenerationSuccess(Date.now() - startTime);
      return generatedStory;
    } catch (error) {
      this.metricsService.recordGenerationFailure();

      const stage =
        error instanceof AIValidationException ? 'validator' : 'pipeline';

      this.lifecycleManager.recordFailure(
        user,
        requestId,
        childId,
        stage,
        error,
      );

      try {
        const currentRequest = await this.storiesService.getStoryById(
          user,
          requestId,
        );
        if (currentRequest && currentRequest.status !== StoryStatus.FAILED) {
          await this.lifecycleManager.transitionStatus(
            user,
            requestId,
            currentRequest.status,
            StoryStatus.FAILED,
          );
        }
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
    let age = 6;
    if (childId) {
      try {
        const child = await this.childrenService.getChild(user.id, childId);
        if (child) age = child.age || 6;
      } catch {
        // Fallback age
      }
    }
    const level = readingLevel || (age <= 5 ? 'level_1' : age <= 8 ? 'level_2' : 'level_3');
    return this.aiGateway.planStory(
      age,
      language,
      theme,
      selGoal,
      level,
    );
  }
}
