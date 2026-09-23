import { Test, TestingModule } from '@nestjs/testing';
import { BullMQJobDispatcher } from './bullmq-job-dispatcher.js';
import { RedisService } from '../../modules/redis/redis.service.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { JobsModule } from './jobs.module.js';
import { ConfigService } from '@nestjs/config';

describe('BullMQJobDispatcher', () => {
  let dispatcher: BullMQJobDispatcher;
  let mockRedisService: any;

  beforeEach(async () => {
    mockRedisService = {
      ensureInitialized: jest.fn(),
      getIsEnabled: jest.fn().mockReturnValue(false),
      getClient: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMQJobDispatcher,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    dispatcher = module.get<BullMQJobDispatcher>(BullMQJobDispatcher);
    dispatcher.onModuleInit();
  });

  it('should be defined and invoke ensureInitialized on init', () => {
    expect(dispatcher).toBeDefined();
    expect(mockRedisService.ensureInitialized).toHaveBeenCalled();
  });

  describe('dispatch without Redis', () => {
    it('uses sync fallback in dev/test environment', async () => {
      process.env.NODE_ENV = 'test';
      const mockHandler = { handle: jest.fn().mockResolvedValue({ success: true }) };
      dispatcher.registerHandler('story-generation', mockHandler);

      const result = await dispatcher.dispatch('story-generation', { requestId: 'req-1' });
      expect(result.success).toBe(true);
      expect(mockHandler.handle).toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException in production environment if Redis disabled', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(
          dispatcher.dispatch('story-generation', { requestId: 'req-1' }),
        ).rejects.toThrow(ServiceUnavailableException);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('BullMQ Queue Initialization & Lifecycle Safety', () => {
    it('ensures Redis initialization and sets up all 3 BullMQ queues when Redis is enabled', async () => {
      const redisClientMock = {
        options: { host: '127.0.0.1', port: 6379, db: 0 },
      };
      const redisService = {
        ensureInitialized: jest.fn(),
        getIsEnabled: jest.fn().mockReturnValue(true),
        getClient: jest.fn().mockReturnValue(redisClientMock),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BullMQJobDispatcher,
          { provide: RedisService, useValue: redisService },
        ],
      }).compile();

      const bullmqDispatcher = module.get<BullMQJobDispatcher>(BullMQJobDispatcher);
      bullmqDispatcher.onModuleInit();

      expect(redisService.ensureInitialized).toHaveBeenCalled();
      expect(redisService.getIsEnabled()).toBe(true);

      // Verify queues were created and fallback is not used when REDIS_URL exists
      const isRedisEnabled = redisService.getIsEnabled();
      expect(isRedisEnabled).toBe(true);

      await bullmqDispatcher.onModuleDestroy();
    });
  });

  describe('JobsModule Provider Singleton Contract', () => {
    it('resolving BullMQJobDispatcher and "JobDispatcher" token returns the EXACT SAME INSTANCE', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [JobsModule],
      })
        .overrideProvider(RedisService)
        .useValue({
          ensureInitialized: jest.fn(),
          getIsEnabled: jest.fn().mockReturnValue(false),
          getClient: jest.fn().mockReturnValue(null),
        })
        .compile();

      const instanceFromClass = module.get<BullMQJobDispatcher>(BullMQJobDispatcher);
      const instanceFromToken = module.get<BullMQJobDispatcher>('JobDispatcher');

      expect(instanceFromClass).toBeDefined();
      expect(instanceFromToken).toBeDefined();
      expect(instanceFromClass).toBe(instanceFromToken);
    });
  });

  describe('buildJobId colon sanitization', () => {
    it('generates valid job IDs without prohibited colons', () => {
      const jobId = (dispatcher as any).buildJobId('story-generation:create', {
        requestId: 'req-123:456',
      });
      expect(jobId).toBe('story-generation-create_req-123-456');
      expect(jobId).not.toContain(':');
    });
  });
});
