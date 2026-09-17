import { Injectable } from '@nestjs/common';
import { JobHandler, JobPayload, JobResult } from '../../../common/jobs/job.interface.js';
import { StoryGenerationOrchestrator } from '../../ai/orchestrator/story-generation.orchestrator.js';
import { AIProviderUnavailableException } from '../../ai/exceptions/ai.exceptions.js';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';

export interface StoryGenerationPayload extends JobPayload {
  type: 'story-generation';
  data: {
    user: UserContext;
    requestId: string;
  };
}

@Injectable()
export class StoryGenerationJobHandler implements JobHandler<StoryGenerationPayload> {
  constructor(private readonly orchestrator: StoryGenerationOrchestrator) {}

  async handle(payload: StoryGenerationPayload): Promise<JobResult> {
    const { user, requestId } = payload.data;
    try {
      const story = await this.orchestrator.generateStory(user, requestId);
      return {
        success: true,
        jobId: '',
        data: story,
      };
    } catch (err: any) {
      // A temporary provider outage must stay retryable for the caller
      // (HTTP 503) instead of collapsing into a generic job failure.
      if (err instanceof AIProviderUnavailableException) throw err;
      return {
        success: false,
        jobId: '',
        error: err.message || String(err),
      };
    }
  }
}
