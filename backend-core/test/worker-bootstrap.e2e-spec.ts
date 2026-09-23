import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

// Force IS_WORKER = true to reproduce real worker application context
process.env.IS_WORKER = 'true';

import { WorkerModule } from '../src/worker.module.js';
import { StoryGenerationProcessor } from '../src/modules/stories/processors/story-generation.processor.js';
import { StoryMediaProcessor } from '../src/modules/media/processors/story-media.processor.js';
import { StoryExportProcessor } from '../src/modules/media/processors/story-export.processor.js';
import { RedisService } from '../src/modules/redis/redis.service.js';

describe('WorkerModule Bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should successfully resolve and inject RedisService into StoryGenerationProcessor', () => {
    const processor = app.get(StoryGenerationProcessor);
    expect(processor).toBeDefined();
    expect((processor as any).redisService).toBeDefined();
    expect((processor as any).redisService).toBeInstanceOf(RedisService);
    expect(typeof (processor as any).redisService.getIsEnabled).toBe('function');
  });

  it('should successfully resolve and inject RedisService into StoryMediaProcessor', () => {
    const processor = app.get(StoryMediaProcessor);
    expect(processor).toBeDefined();
    expect((processor as any).redisService).toBeDefined();
    expect((processor as any).redisService).toBeInstanceOf(RedisService);
    expect(typeof (processor as any).redisService.getIsEnabled).toBe('function');
  });

  it('should successfully resolve and inject RedisService into StoryExportProcessor without throwing TypeError', () => {
    const processor = app.get(StoryExportProcessor);
    expect(processor).toBeDefined();
    expect((processor as any).redisService).toBeDefined();
    expect((processor as any).redisService).toBeInstanceOf(RedisService);
    expect(typeof (processor as any).redisService.getIsEnabled).toBe('function');
  });
});
