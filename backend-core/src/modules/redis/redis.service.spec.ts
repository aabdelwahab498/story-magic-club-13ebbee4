import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service.js';

describe('RedisService Lifecycle & Idempotency Tests', () => {
  it('1. ensureInitialized with REDIS_URL enables Redis, creates one client, and repeated calls are idempotent', async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    const service = module.get<RedisService>(RedisService);

    expect(service.getIsEnabled()).toBe(false);
    expect(service.getClient()).toBeNull();

    // Call ensureInitialized first time
    service.ensureInitialized();

    expect(service.getIsEnabled()).toBe(true);
    const client1 = service.getClient();
    expect(client1).not.toBeNull();

    // Call ensureInitialized second time (idempotency check)
    service.ensureInitialized();

    expect(service.getIsEnabled()).toBe(true);
    const client2 = service.getClient();
    expect(client2).toBe(client1);

    // Module init should also be idempotent
    service.onModuleInit();
    expect(service.getClient()).toBe(client1);

    await service.onModuleDestroy();
  });

  it('2. ensureInitialized without REDIS_URL remains disabled', async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    const service = module.get<RedisService>(RedisService);

    service.ensureInitialized();

    expect(service.getIsEnabled()).toBe(false);
    expect(service.getClient()).toBeNull();
  });
});
