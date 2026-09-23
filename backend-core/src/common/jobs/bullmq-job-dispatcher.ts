import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { JobDispatcher, JobHandler, JobPayload, JobResult } from './job.interface.js';
import { SyncJobDispatcher } from './sync-job-dispatcher.js';
import { RedisService } from '../../modules/redis/redis.service.js';
import { RequestContext } from '../middleware/request-context.js';

@Injectable()
export class BullMQJobDispatcher
  implements JobDispatcher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullMQJobDispatcher.name);
  private readonly queues = new Map<string, Queue>();
  private readonly syncFallback = new SyncJobDispatcher();

  constructor(private readonly redisService: RedisService) {}

  onModuleInit(): void {
    this.redisService.ensureInitialized();

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

      if (connection && this.queues.size === 0) {
        this.queues.set(
          'story-generation',
          new Queue('story-generation', { connection }),
        );
        this.queues.set(
          'story-media',
          new Queue('story-media', { connection }),
        );
        this.queues.set(
          'story-export',
          new Queue('story-export', { connection }),
        );
        this.logger.log('Initialized BullMQ queues (story-generation, story-media, story-export)');
      }
    } else {
      this.logger.log('Redis not enabled. BullMQJobDispatcher utilizing synchronous fallback');
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        this.logger.log(`Closed queue ${name}`);
      } catch (err: any) {
        this.logger.warn(`Error closing queue ${name}: ${err.message}`);
      }
    }
  }

  registerHandler(type: string, handler: JobHandler): void {
    this.syncFallback.registerHandler(type, handler);
  }

  async dispatch<P extends JobPayload = JobPayload, R = any>(
    type: string,
    data: P['data'],
  ): Promise<JobResult<R>> {
    const isRedisEnabled = this.redisService.getIsEnabled();
    const isProduction = process.env.NODE_ENV === 'production';

    const payloadData: Record<string, any> = { ...data };
    if (!payloadData.userJwt && RequestContext.authToken) {
      payloadData.userJwt = RequestContext.authToken;
    }

    if (!isRedisEnabled) {
      if (isProduction) {
        this.logger.error('Production requirement failure: Redis queue unavailable');
        throw new ServiceUnavailableException('Queue service is unavailable');
      }
      this.logger.debug(`Dispatching job type ${type} using sync fallback (dev/test environment)`);
      return this.syncFallback.dispatch(type, payloadData);
    }

    const queueName = this.resolveQueueName(type);
    const queue = this.queues.get(queueName);

    if (!queue) {
      this.logger.error(`No BullMQ queue mapped for job type ${type}`);
      return {
        success: false,
        jobId: 'unmapped',
        error: `No BullMQ queue mapped for job type ${type}`,
      };
    }

    const customJobId = this.buildJobId(type, payloadData);

    try {
      const job = await queue.add(type, payloadData, {
        jobId: customJobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      });

      this.logger.log(
        `[JOB_ENQUEUED] Enqueued job ${job.id} of type ${type} into queue ${queueName}`,
      );

      return {
        success: true,
        jobId: String(job.id),
      };
    } catch (err: any) {
      this.logger.error(`Failed to enqueue job of type ${type}`, err);
      if (isProduction) {
        throw new ServiceUnavailableException('Failed to enqueue job');
      }
      return this.syncFallback.dispatch(type, data);
    }
  }

  private resolveQueueName(type: string): string {
    if (type.startsWith('story-generation') || type === 'story-generation') {
      return 'story-generation';
    }
    if (
      type.startsWith('media') ||
      type.startsWith('audio') ||
      type.startsWith('illustration') ||
      type === 'story-media'
    ) {
      return 'story-media';
    }
    if (type.startsWith('export') || type.startsWith('story-export')) {
      return 'story-export';
    }
    return 'story-generation';
  }

  private buildJobId(type: string, data: Record<string, any>): string | undefined {
    const rawId = data.requestId || data.storyId;
    if (rawId) {
      const sanitizedType = String(type).replace(/:/g, '-');
      const sanitizedId = String(rawId).replace(/:/g, '-');
      return `${sanitizedType}_${sanitizedId}`;
    }
    return undefined;
  }
}
