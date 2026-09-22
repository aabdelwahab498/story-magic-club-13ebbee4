import { Test, TestingModule } from '@nestjs/testing';
import { StoriesRepository } from './stories.repository.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StoryStatus } from '../enums/story-status.enum.js';

describe('StoriesRepository', () => {
  let repository: StoriesRepository;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesRepository,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    repository = module.get<StoriesRepository>(StoriesRepository);
  });

  it('should create request', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: '1', user_id: 'u1', status: 'draft' },
      error: null,
    });
    const result = await repository.createRequest(
      'u1',
      { childId: 'c1', theme: 'x', selGoal: 'y', language: 'en' },
      'L1',
    );
    expect(result.id).toBe('1');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: {} }),
    );
  });

  it('should throw on create request error', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: true,
    });
    await expect(
      repository.createRequest(
        'u1',
        { childId: 'c1', theme: 'x', selGoal: 'y', language: 'en' },
        'L1',
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should find by child', async () => {
    const mockChain = {
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve({ data: [{ id: '1' }], error: null })),
    };
    mockSupabaseClient.select.mockReturnValueOnce(mockChain);
    const result = await repository.findByChild('u1', 'c1');
    expect(result[0].id).toBe('1');
  });

  it('should find by id', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: '1' },
      error: null,
    });
    const result = await repository.findById('u1', '1');
    expect(result.id).toBe('1');
  });

  it('should throw if not found by id', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: true,
    });
    await expect(repository.findById('u1', '1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update status', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: '1' },
      error: null,
    });
    const result = await repository.updateStatus(
      'u1',
      '1',
      StoryStatus.GENERATED,
    );
    expect(result.id).toBe('1');
  });

  it('should delete', async () => {
    const mockChain = {
      eq: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve({ error: null })),
    };
    mockSupabaseClient.delete.mockReturnValueOnce(mockChain);
    const result = await repository.delete('u1', '1');
    expect(result).toBe(true);
  });
});
