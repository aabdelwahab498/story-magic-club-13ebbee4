import { Test, TestingModule } from '@nestjs/testing';
import { ChildPreferencesService } from './preferences.service.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { NotFoundException } from '@nestjs/common';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { Role } from '../../rbac/enums/role.enum.js';

describe('ChildPreferencesService', () => {
  let service: ChildPreferencesService;

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
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildPreferencesService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<ChildPreferencesService>(ChildPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should return preferences successfully', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          bedtime_preferences: {
            interests: ['space'],
            favorite_topics: ['stars'],
            story_style: 'adventurous',
            difficulty_level: 'easy',
          },
          emotional_focus: {
            goals: ['confidence'],
          },
        },
        error: null,
      });

      const result = await service.getPreferences(mockUser, 'child-1');

      expect(result).toEqual({
        interests: ['space'],
        favoriteTopics: ['stars'],
        storyStyle: 'adventurous',
        difficultyLevel: 'easy',
        emotionalGoals: ['confidence'],
      });
    });

    it('should throw NotFoundException if child not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(service.getPreferences(mockUser, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      // Fetch mock
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          bedtime_preferences: { interests: ['space'] },
          emotional_focus: { goals: ['confidence'] },
        },
        error: null,
      });

      // Update mock
      mockSupabaseClient.update.mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null }),
        }),
      } as any);

      // Final fetch mock
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          bedtime_preferences: { interests: ['space', 'aliens'] },
          emotional_focus: { goals: ['confidence'] },
        },
        error: null,
      });

      const result = await service.updatePreferences(mockUser, 'child-1', {
        interests: ['space', 'aliens'],
      });

      expect(result.interests).toEqual(['space', 'aliens']);
    });
  });
});
