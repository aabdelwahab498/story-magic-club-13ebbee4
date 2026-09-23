import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { RequestContext } from '../../../common/middleware/request-context.js';
import { RedisService } from '../../redis/redis.service.js';
import { IllustratedStoryExportService } from '../export/illustrated-story-export.service.js';

@Injectable()
export class StoryExportProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoryExportProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly exportService: IllustratedStoryExportService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    const isWorker = process.env.IS_WORKER === 'true';
    if (!isWorker) {
      this.logger.log('StoryExportProcessor: HTTP process acting as producer-only (IS_WORKER != true). Worker consumer skipped.');
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
          'story-export',
          async (job: Job) => this.process(job),
          {
            connection,
            removeOnComplete: { count: 100, age: 86400 },
            removeOnFail: { count: 500, age: 604800 },
          },
        );
        this.logger.log('StoryExportProcessor BullMQ Worker started');
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { format, storyId, userId, userJwt: payloadUserJwt, user: payloadUser } = job.data;
    const userJwt = payloadUserJwt || payloadUser?.jwt;

    this.logger.log(
      `[WORKER_START] Processing export job ${job.id} (format: ${format}) for story ${storyId}`,
    );

    return await RequestContext.run(
      {
        requestId: String(job.id || storyId || 'export-req'),
        traceId: String(job.id || 'export-trace'),
        userId,
        authToken: userJwt,
      },
      async () => {
        try {
          if (format === 'pdf') {
            return await this.exportService.exportStoryPdf(storyId, userId);
          }
          if (format === 'audio') {
            return await this.exportService.exportStoryAudio(storyId, userId);
          }
          if (format === 'zip') {
            return await this.exportService.exportStoryZip(storyId, userId);
          }

          this.logger.warn(`Unknown export format: ${format}`);
          return { success: false, error: `Unknown export format: ${format}` };
        } catch (err: any) {
          this.logger.error(
            `[WORKER_ERROR] Export job ${job.id} failed for story ${storyId}: ${err.message}`,
            err.stack,
          );

          const isLastAttempt = job.attemptsMade + 1 >= (job.opts?.attempts || 3);
          if (isLastAttempt || err.name === 'NotFoundException') {
            throw new UnrecoverableError(err.message || 'Story export permanently failed');
          }
          throw err;
        }
      },
    );
  }
}
