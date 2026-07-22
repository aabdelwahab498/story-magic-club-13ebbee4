import { Injectable } from '@nestjs/common';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { StoriesService } from '../stories.service.js';
import { StoryStatus } from '../enums/story-status.enum.js';
import { StoryLifecycleLogger } from './story-lifecycle.logger.js';
import { StoryLifecycleEvents } from './story-lifecycle.events.js';
import { InvalidStatusTransitionException } from './exceptions/invalid-transition.exception.js';
import {
  FailureMetadata,
  StoryEventPayload,
} from './interfaces/lifecycle.interfaces.js';

@Injectable()
export class StoryLifecycleManager {
  private readonly validTransitions: Record<StoryStatus, StoryStatus[]> = {
    [StoryStatus.DRAFT]: [StoryStatus.QUEUED],
    [StoryStatus.QUEUED]: [StoryStatus.GENERATING, StoryStatus.FAILED], // Could fail directly if validation fails
    [StoryStatus.GENERATING]: [StoryStatus.GENERATED, StoryStatus.FAILED],
    [StoryStatus.GENERATED]: [], // Terminal success state before completion
    [StoryStatus.ILLUSTRATING]: [], // Future
    [StoryStatus.NARRATING]: [], // Future
    [StoryStatus.COMPLETED]: [], // Future
    [StoryStatus.FAILED]: [StoryStatus.QUEUED], // Retry path
  };

  constructor(
    private readonly storiesService: StoriesService,
    private readonly logger: StoryLifecycleLogger,
    private readonly events: StoryLifecycleEvents,
  ) {}

  async transitionStatus(
    user: UserContext,
    requestId: string,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ): Promise<void> {
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new InvalidStatusTransitionException(currentStatus, newStatus);
    }

    // Persist transition
    await this.storiesService.updateStoryStatus(user, requestId, newStatus);

    // Get the basic details to build event payload
    const request = await this.storiesService.getStoryById(user, requestId);

    const payload: StoryEventPayload = {
      requestId,
      userId: user.id,
      childId: request.childId,
      status: newStatus,
      timestamp: new Date(),
    };

    // Emit appropriate event
    this.emitEventForStatus(newStatus, payload);

    // Log the transition
    this.logger.logTransition(
      requestId,
      user.id,
      request.childId,
      currentStatus,
      newStatus,
    );
  }

  recordFailure(
    user: UserContext,
    requestId: string,
    childId: string,
    stage: string,
    error: any,
  ): FailureMetadata {
    const failure: FailureMetadata = {
      stage,
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      retryable: error.retryable ?? false,
      timestamp: new Date(),
    };

    this.logger.logFailure(requestId, user.id, childId, stage, error);

    // In the future, this is where we'd persist the FailureMetadata to DB
    // e.g., await this.storiesService.updateFailureMetadata(user, requestId, failure);

    return failure;
  }

  updateProgress(
    user: UserContext,
    requestId: string,
    childId: string,
    stage: string,
    percentage: number,
  ): void {
    this.logger.logProgress(requestId, user.id, childId, stage, percentage);
    // In the future, we could emit a ProgressUpdatedEvent or save to DB for UI polling.
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async cancelGeneration(user: UserContext, requestId: string): Promise<void> {
    // Architectural stub for future cancellation feature
    // Verify request belongs to user, transition to CANCELLED state (which would need to be added to StoryStatus enum)
    throw new Error(
      `Cancellation is not implemented yet for user ${user.id} and request ${requestId}.`,
    );
  }

  private isValidTransition(current: StoryStatus, next: StoryStatus): boolean {
    const allowed = this.validTransitions[current] || [];
    return allowed.includes(next);
  }

  private emitEventForStatus(
    status: StoryStatus,
    payload: StoryEventPayload,
  ): void {
    switch (status) {
      case StoryStatus.QUEUED:
        this.events.emitQueued(payload);
        break;
      case StoryStatus.GENERATING:
        this.events.emitGenerationStarted(payload);
        break;
      case StoryStatus.GENERATED:
        this.events.emitGenerationCompleted(payload);
        break;
      case StoryStatus.FAILED:
        this.events.emitGenerationFailed(payload);
        break;
    }
  }
}
