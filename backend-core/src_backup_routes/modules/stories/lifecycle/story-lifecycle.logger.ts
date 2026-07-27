import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StoryLifecycleLogger {
  private readonly logger = new Logger('StoryLifecycle');

  logTransition(
    requestId: string,
    userId: string,
    childId: string,
    fromStatus: string,
    toStatus: string,
  ): void {
    const payload = {
      requestId,
      userId,
      childId,
      event: 'STATUS_TRANSITION',
      from: fromStatus,
      to: toStatus,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(payload));
  }

  logProgress(
    requestId: string,
    userId: string,
    childId: string,
    stage: string,
    percentage: number,
  ): void {
    const payload = {
      requestId,
      userId,
      childId,
      event: 'PROGRESS_UPDATE',
      stage,
      percentage,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(payload));
  }

  logFailure(
    requestId: string,
    userId: string,
    childId: string,
    stage: string,
    error: any,
  ): void {
    const payload = {
      requestId,
      userId,
      childId,
      event: 'GENERATION_FAILED',
      stage,
      errorCode: error.name || 'UNKNOWN_ERROR',
      errorMessage: error.message || 'An unknown error occurred',
      retryable: error.retryable ?? false,
      timestamp: new Date().toISOString(),
    };
    this.logger.error(JSON.stringify(payload));
  }

  logExecutionTime(
    requestId: string,
    stage: string,
    durationMs: number,
    provider?: string,
  ): void {
    const payload = {
      requestId,
      event: 'EXECUTION_TIME',
      stage,
      durationMs,
      provider,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(payload));
  }
}
