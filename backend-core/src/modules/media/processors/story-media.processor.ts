import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job, Worker, UnrecoverableError } from 'bullmq';
import { AudioService } from '../audio.service.js';
import { MediaService } from '../media.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { RequestContext } from '../../../common/middleware/request-context.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../common/resilience/provider-error.classifier.js';

@Injectable()
export class StoryMediaProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoryMediaProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly audioService: AudioService,
    private readonly mediaService: MediaService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    const isWorker = process.env.IS_WORKER === 'true';
    if (!isWorker) {
      this.logger.log('StoryMediaProcessor: HTTP process acting as producer-only (IS_WORKER != true). Worker consumer skipped.');
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
          'story-media',
          async (job: Job) => this.process(job),
          {
            connection,
            removeOnComplete: { count: 100, age: 86400 },
            removeOnFail: { count: 500, age: 604800 },
          },
        );
        this.logger.log('StoryMediaProcessor BullMQ Worker started');
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { type, storyId, mediaId, pageNumber, userId, userJwt: payloadUserJwt, user: payloadUser } = job.data;
    const userJwt = payloadUserJwt || payloadUser?.jwt;
    const attempt = (job.attemptsMade || 0) + 1;
    const maxAttempts = job.opts?.attempts || 3;

    this.logger.log(
      `[WORKER_START] Processing media job ${job.id} (type: ${type}, attempt: ${attempt}/${maxAttempts}) for story ${storyId}`,
    );

    return await RequestContext.run(
      {
        requestId: String(job.id || storyId || 'media-req'),
        traceId: String(job.id || 'media-trace'),
        userId,
        authToken: userJwt,
      },
      async () => {
        try {
          if (type === 'audio-generation' || type === 'story-audio') {
            return await this.audioService.generateNarration(storyId);
          }

          if (type === 'illustration-job' || type === 'story-illustration') {
            if (pageNumber && userId) {
              return await this.mediaService.regeneratePageIllustration(
                storyId,
                pageNumber,
                userId,
              );
            }
            return await this.mediaService.createIllustrationJob(storyId, userId || payloadUser || 'system');
          }

          this.logger.warn(`Unknown story-media job type: ${type}`);
          return { success: false, error: `Unknown media job type: ${type}` };
        } catch (err: any) {
          const classified = classifyProviderError(err);
          const sanitizedMsg = sanitizeSecrets(classified.message);
          const isLastAttempt = attempt >= maxAttempts;

          this.logger.error(
            `[WORKER_ERROR] Media job ${job.id} (story: ${storyId}, page: ${pageNumber || 'N/A'}, attempt: ${attempt}/${maxAttempts}, category: ${classified.category}, status: ${classified.statusCode || 'N/A'}, retryable: ${classified.isRetryable}, exhausted: ${isLastAttempt}) failed: ${sanitizedMsg}`,
            err.stack,
          );

          if (isLastAttempt || !classified.isRetryable || err.name === 'NotFoundException') {
            throw new UnrecoverableError(sanitizedMsg || 'Media processing permanently failed');
          }
          throw err;
        }
      },
    );
  }
}
