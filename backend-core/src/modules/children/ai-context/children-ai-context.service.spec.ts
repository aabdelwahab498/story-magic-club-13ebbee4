import { Test, TestingModule } from '@nestjs/testing';
import { ChildrenAIContextService } from './children-ai-context.service.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ChildPreferencesService } from '../preferences/preferences.service.js';
import { NotFoundException } from '@nestjs/common';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { Role } from '../../rbac/enums/role.enum.js';

describe('ChildrenAIContextService', () => {
  let service: ChildrenAIContextService;
  let preferencesService: ChildPreferencesService;

  const mockUser: UserContext = {
    id: 'parent-1',
    email: 'test@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildrenAIContextService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: ChildPreferencesService,
          useValue: {
            getPreferences: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChildrenAIContextService>(ChildrenAIContextService);
    preferencesService = module.get<ChildPreferencesService>(
      ChildPreferencesService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildContext', () => {
    it('should successfully build deterministic context', async () => {
      // Profile mock
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { age: 6, preferred_language: 'en', reading_level: 'beginner' },
        error: null,
      });

      // Preferences mock
      jest.spyOn(preferencesService, 'getPreferences').mockResolvedValueOnce({
        interests: ['space'],
        favoriteTopics: ['stars'],
        storyStyle: 'adventurous',
        difficultyLevel: 'easy',
        emotionalGoals: ['confidence'],
      });

      // Progress mock
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: [
          {
            previous_level: 'none',
            new_level: 'beginner',
            reason: 'starting out',
            created_at: '2023-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      });

      const result = await service.buildContext(mockUser, 'child-1');

      expect(result).toEqual({
        age: 6,
        language: 'en',
        readingLevel: 'beginner',
        interests: ['space'],
        emotionalGoals: ['confidence'],
        preferences: {
          favoriteTopics: ['stars'],
          storyStyle: 'adventurous',
          difficultyLevel: 'easy',
        },
        learningHistory: [
          {
            previousLevel: 'none',
            newLevel: 'beginner',
            reason: 'starting out',
            date: '2023-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('should throw NotFoundException if child profile not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(service.buildContext(mockUser, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
