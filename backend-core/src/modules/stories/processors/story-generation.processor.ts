import { Injectable, Logger, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker, UnrecoverableError } from 'bullmq';
import { StoryGenerationOrchestrator } from '../../ai/orchestrator/story-generation.orchestrator.js';
import { StoriesRepository } from '../repositories/stories.repository.js';
import { StoryStatus } from '../enums/story-status.enum.js';
import { RedisService } from '../../redis/redis.service.js';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';

import { RequestContext } from '../../../common/middleware/request-context.js';

@Injectable()
export class StoryGenerationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoryGenerationProcessor.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(forwardRef(() => StoryGenerationOrchestrator))
    private readonly orchestrator: StoryGenerationOrchestrator,
    private readonly storiesRepository: StoriesRepository,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    const isWorker = process.env.IS_WORKER === 'true';
    if (!isWorker) {
      this.logger.log('StoryGenerationProcessor: HTTP process acting as producer-only (IS_WORKER != true). Worker consumer skipped.');
      return;
    }

    if (this.redisService.getIsEnabled()) {
      const redisClient = this.redisService.getClient();
      const connection = redisClient
        ? {
            host: redisClient.options.host || 'localhost',
            port: redisClient.options.port || 6379,
            password: redisClient.options.password,
            db: redisClient.options.db || 0,
            maxRetriesPerRequest: null,
          }
        : undefined;

      if (connection) {
        this.worker = new Worker(
          'story-generation',
          async (job: Job) => this.process(job),
          {
            connection,
            removeOnComplete: { count: 100, age: 86400 },
            removeOnFail: { count: 500, age: 604800 },
          },
        );
        this.logger.log('StoryGenerationProcessor BullMQ Worker started');
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { requestId, user: payloadUser, userId: payloadUserId, userJwt: payloadUserJwt } = job.data;
    const userId = payloadUser?.id || payloadUserId;
    const userJwt = payloadUserJwt || payloadUser?.jwt;

    this.logger.log(
      `[WORKER_START] Processing story generation job ${job.id} for request ${requestId} (attempt ${job.attemptsMade + 1})`,
    );

    const user: UserContext = payloadUser || {
      id: userId,
      email: 'system-worker@najmah.internal',
      role: 'user' as any,
      roles: ['user' as any],
      permissions: [],
    };

    return await RequestContext.run(
      {
        requestId: String(job.id || requestId || 'worker-req'),
        traceId: String(job.id || 'worker-trace'),
        userId,
        authToken: userJwt,
      },
      async () => {
        try {
          // Invoke canonical generation orchestrator (handles lifecycle forward-transitions)
          await this.orchestrator.generateStory(user, requestId);

          this.logger.log(
            `[WORKER_SUCCESS] Story generation job ${job.id} completed for request ${requestId}`,
          );
          return { success: true, requestId };
        } catch (err: any) {
          this.logger.error(
            `[WORKER_ERROR] Story generation attempt ${job.attemptsMade + 1} failed for request ${requestId}: ${err.message}`,
            err.stack,
          );

          const isLastAttempt = job.attemptsMade + 1 >= (job.opts?.attempts || 3);
          const isUnrecoverable =
            err.name === 'NotFoundException' ||
            err.name === 'BadRequestException' ||
            err.message?.includes('not found') ||
            isLastAttempt;

          if (isUnrecoverable) {
            this.logger.warn(
              `[JOB_PERMANENT_FAILURE] Marking story_request ${requestId} as FAILED`,
            );
            try {
              await this.storiesRepository.updateStatus(
                user.id,
                requestId,
                StoryStatus.FAILED,
              );
            } catch {
              // Best effort status update
            }
            throw new UnrecoverableError(err.message || 'Story generation permanently failed');
          }

          throw err;
        }
      },
    );
  }
}
