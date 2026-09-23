import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateStoryRequestDto } from './dto/create-story-request.dto.js';
import { StoryResponseDto } from './dto/story-response.dto.js';
import { StoryStatus } from './enums/story-status.enum.js';
import { StoriesService } from './stories.service.js';
import { StoriesRepository } from './repositories/stories.repository.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { ChildrenService } from '../children/children.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import { AI_GATEWAY } from '../ai/gateway/ai-gateway.interface.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';

describe('BE-GAP-003 Story Compatibility Tests', () => {
  describe('A. CreateStoryRequestDto Validation', () => {
    it('should validate an existing request with childId', async () => {
      const dto = plainToInstance(CreateStoryRequestDto, {
        childId: '123e4567-e89b-12d3-a456-426614174000',
        theme: 'Space Adventure',
        selGoal: 'Courage',
        language: 'en',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate an authenticated request without childId using childName and age', async () => {
      const dto = plainToInstance(CreateStoryRequestDto, {
        childName: 'Leo',
        age: 7,
        theme: 'Underwater Exploration',
        selGoal: 'Empathy',
        language: 'en',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid fallback age', async () => {
      const dto = plainToInstance(CreateStoryRequestDto, {
        childName: 'Leo',
        age: 2, // Minimum is 3
        theme: 'Jungle',
        selGoal: 'Kindness',
        language: 'en',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('age');
    });

    it('should accept optional emotionalFocus, customPrompt, and presetBlueprint', async () => {
      const dto = plainToInstance(CreateStoryRequestDto, {
        childName: 'Aria',
        age: 6,
        theme: 'Dragons & Magic',
        selGoal: 'Resilience',
        language: 'en',
        emotionalFocus: ['Empathy', 'Courage'],
        customPrompt: 'Include a blue dragon named Spark',
        presetBlueprint: { title: 'Spark the Dragon', pageCount: 5 },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.emotionalFocus).toEqual(['Empathy', 'Courage']);
      expect(dto.customPrompt).toBe('Include a blue dragon named Spark');
      expect(dto.presetBlueprint).toBeDefined();
    });
  });

  describe('D. StoryResponseDto Compatibility Fields', () => {
    it('should preserve standard fields and support enriched SEL compatibility fields', () => {
      const res: StoryResponseDto = {
        id: 'req-uuid-123',
        userId: 'user-uuid-456',
        childId: 'child-uuid-789',
        status: StoryStatus.GENERATED,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          language: 'en',
          readingLevel: 'level_2',
          theme: 'Space Adventure',
          selGoal: 'Courage',
          pageCount: 5,
          estimatedReadingTime: 5,
        },
        title: 'Leo in Space',
        pages: [{ pageNumber: 1, text: 'Once upon a time...' }],

        // Enriched SEL fields
        story_id: 'req-uuid-123',
        sel_outcome: { skill: 'Courage', emotion: 'calm', statement: 'Learned about courage.' },
        character_visual_hash: 'a1b2c3d4e5f6',
        age_band: '6-8',
        quality: { total: 20, passed: true },
        safety: { passed: true, violations: [] },
        length: { passed: true, pageCount: 5 },
        passed: true,
        regeneration_count: 0,
        blueprint: { title: 'Leo in Space' },
      };

      expect(res.id).toBe('req-uuid-123');
      expect(res.story_id).toBe('req-uuid-123');
      expect(res.sel_outcome?.skill).toBe('Courage');
      expect(res.character_visual_hash).toBe('a1b2c3d4e5f6');
      expect(res.age_band).toBe('6-8');
      expect(res.passed).toBe(true);
      expect(res.regeneration_count).toBe(0);
    });
  });

  describe('E. Child Fallback Validation', () => {
    let service: any;
    const mockUser: any = { id: 'user-1', email: 'test@example.com' };
    const mockChildrenService = {
      getChild: jest.fn().mockImplementation(async (userId, childId) => {
        if (childId === 'valid-child-id') {
          return { id: 'valid-child-id', name: 'Canonical Child', age: 8 };
        }
        throw new Error('Child not found');
      }),
    };
    const mockStoriesRepository = {
      createRequest: jest.fn().mockResolvedValue({ id: 'req-1' }),
      getFullStory: jest.fn().mockResolvedValue({
        metadata: {
          id: 'req-1',
          userId: 'user-1',
          childId: null,
          status: StoryStatus.GENERATED,
          createdAt: new Date(),
          updatedAt: new Date(),
          theme: 'Space',
          selGoal: 'Bravery',
          language: 'en',
          readingLevel: 'level_2',
        },
        content: {
          title: 'Story Title',
          pages: [],
        },
      }),
    };
    const mockSubscriptionsService = {
      getUserSubscription: jest.fn().mockResolvedValue({
        plan: 'free',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: {},
      }),
      canAccessFeature: jest.fn().mockResolvedValue({ allowed: true }),
      checkStoryQuota: jest.fn().mockResolvedValue({
        allowed: true,
        tier: 'free',
        daily_used: 0,
        daily_limit: 3,
        monthly_used: 0,
        monthly_limit: 30,
        reason: null,
      }),
      getMonthlyUsage: jest.fn().mockResolvedValue(0),
    };
    const mockCreditsService = {
      getBalance: jest.fn().mockResolvedValue({ balance: 100 }),
    };
    const mockJobDispatcher = {
      dispatch: jest.fn().mockResolvedValue({ success: true }),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StoriesService,
          { provide: StoriesRepository, useValue: mockStoriesRepository },
          { provide: ChildrenAIContextService, useValue: { buildContext: jest.fn().mockResolvedValue({ readingLevel: 'level_2' }) } },
          { provide: ChildrenService, useValue: mockChildrenService },
          { provide: StoryGenerationOrchestrator, useValue: {} },
          { provide: AI_GATEWAY, useValue: {} },
          { provide: CreditsService, useValue: mockCreditsService },
          { provide: UsageService, useValue: {} },
          { provide: SubscriptionsService, useValue: mockSubscriptionsService },
          { provide: 'JobDispatcher', useValue: mockJobDispatcher },
        ],
      }).compile();

      service = module.get<StoriesService>(StoriesService);
      jest.clearAllMocks();
    });

    it('no childId + childName + age => PASS', async () => {
      const res = await service.createStory(mockUser, {
        childName: 'Explicit Child',
        age: 7,
        theme: 'Space',
        selGoal: 'Bravery',
        language: 'en',
      });
      expect(res).toBeDefined();
      expect(mockStoriesRepository.createRequest).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ childName: 'Explicit Child', age: 7 }),
        'level_2',
      );
    });

    it('no childId + missing childName => REJECT (400 BadRequestException)', async () => {
      await expect(
        service.createStory(mockUser, {
          age: 7,
          theme: 'Space',
          selGoal: 'Bravery',
          language: 'en',
        }),
      ).rejects.toThrow('When childId is not provided, both childName and age must be explicitly supplied.');
    });

    it('no childId + missing age => REJECT (400 BadRequestException)', async () => {
      await expect(
        service.createStory(mockUser, {
          childName: 'Explicit Child',
          theme: 'Space',
          selGoal: 'Bravery',
          language: 'en',
        }),
      ).rejects.toThrow('When childId is not provided, both childName and age must be explicitly supplied.');
    });

    it('childId path remains valid and uses canonical child profile name and age', async () => {
      const res = await service.createStory(mockUser, {
        childId: 'valid-child-id',
        theme: 'Space',
        selGoal: 'Bravery',
        language: 'en',
      });
      expect(res).toBeDefined();
      expect(mockChildrenService.getChild).toHaveBeenCalledWith('user-1', 'valid-child-id');
      expect(mockStoriesRepository.createRequest).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ childName: 'Canonical Child', age: 8 }),
        'level_2',
      );
    });
  });
});
