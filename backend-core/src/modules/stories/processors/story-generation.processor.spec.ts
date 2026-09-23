import { Test, TestingModule } from '@nestjs/testing';
import { StoryGenerationProcessor } from './story-generation.processor.js';
import { StoryGenerationOrchestrator } from '../../ai/orchestrator/story-generation.orchestrator.js';
import { StoriesRepository } from '../repositories/stories.repository.js';
import { Job, UnrecoverableError } from 'bullmq';
import { RedisService } from '../../redis/redis.service.js';

describe('StoryGenerationProcessor', () => {
  let processor: StoryGenerationProcessor;
  let mockOrchestrator: any;
  let mockRepository: any;

  beforeEach(async () => {
    mockOrchestrator = {
      generateStory: jest.fn().mockResolvedValue({}),
    };

    mockRepository = {
      updateStatus: jest.fn().mockResolvedValue({}),
    };

    const mockRedisService = {
      getIsEnabled: jest.fn().mockReturnValue(false),
      getClient: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryGenerationProcessor,
        { provide: StoryGenerationOrchestrator, useValue: mockOrchestrator },
        { provide: StoriesRepository, useValue: mockRepository },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    processor = module.get<StoryGenerationProcessor>(StoryGenerationProcessor);
  });

  it('should process story generation job successfully', async () => {
    const mockJob = {
      id: 'job-1',
      data: { requestId: 'req-1', userId: 'user-1' },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as unknown as Job;

    const result = await processor.process(mockJob);
    expect(result).toEqual({ success: true, requestId: 'req-1' });
    expect(mockOrchestrator.generateStory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'req-1',
    );
  });

  it('should throw UnrecoverableError and mark failed on last attempt', async () => {
    mockOrchestrator.generateStory.mockRejectedValueOnce(new Error('AI failure'));
    const mockJob = {
      id: 'job-2',
      data: { requestId: 'req-2', userId: 'user-1' },
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as unknown as Job;

    try {
      await processor.process(mockJob);
      fail('Expected process to throw UnrecoverableError');
    } catch (err: any) {
      expect(err.message).toBe('AI failure');
    }
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      'user-1',
      'req-2',
      'failed',
    );
  });
});
