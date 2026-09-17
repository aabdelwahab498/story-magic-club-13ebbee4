import { Injectable, Logger } from '@nestjs/common';
import { JobDispatcher, JobHandler, JobPayload, JobResult } from './job.interface.js';
import { randomUUID } from 'crypto';
import { AIProviderUnavailableException } from '../../modules/ai/exceptions/ai.exceptions.js';

@Injectable()
export class SyncJobDispatcher implements JobDispatcher {
  private readonly logger = new Logger(SyncJobDispatcher.name);
  private readonly handlers = new Map<string, JobHandler>();

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger.log(`Registered handler for job type: ${type}`);
  }

  async dispatch<P extends JobPayload = JobPayload, R = any>(
    type: string,
    data: P['data'],
  ): Promise<JobResult<R>> {
    const jobId = randomUUID();
    this.logger.debug(`Dispatching job ${jobId} of type ${type} synchronously`);

    const handler = this.handlers.get(type);
    if (!handler) {
      this.logger.error(`No handler registered for job type: ${type}`);
      return {
        success: false,
        jobId,
        error: `No handler registered for job type: ${type}`,
      };
    }

    try {
      const result = await handler.handle({ type, data });
      return {
        ...result,
        jobId,
      };
    } catch (err: any) {
      if (err instanceof AIProviderUnavailableException) throw err;
      this.logger.error(`Failed to execute job ${jobId} of type ${type}`, err);
      return {
        success: false,
        jobId,
        error: err.message || String(err),
      };
    }
  }
}
