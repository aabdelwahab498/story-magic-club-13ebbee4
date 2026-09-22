import { Test, TestingModule } from '@nestjs/testing';
import { StoriesService } from './stories.service.js';
import { StoriesRepository } from './repositories/stories.repository.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { ChildrenService } from '../children/children.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import { StoryStatus } from './enums/story-status.enum.js';
import { NotFoundException } from '@nestjs/common';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
describe('StoriesService', () => {
  let service: StoriesService;

  const mockUser: UserContext = {
    id: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  const mockStoriesRepository = {
    createRequest: jest.fn(),
    findByChild: jest.fn(),
    findAllByUser: jest.fn(),
    findById: jest.fn(),
    getFullStory: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  };

  const mockAiContextService = {
    buildContext: jest.fn(),
  };

  const mockChildrenService = {
    getChild: jest.fn(),
  };

  const mockOrchestrator = {
    generateStory: jest.fn(),
    planStory: jest.fn(),
  };

  const mockCreditsService = {
    getBalance: jest.fn().mockResolvedValue({ balance: 100 }),
    consumeCredits: jest.fn(),
  };

  const mockUsageService = {
    trackUsage: jest.fn(),
  };

  const mockSubscriptionsService = {
    canAccessFeature: jest.fn().mockResolvedValue({ allowed: true }),
    checkLimit: jest
      .fn()
      .mockResolvedValue({ allowed: true, current: 0, limit: 3 }),
    getUserSubscription: jest.fn().mockResolvedValue({
      plan: 'FREE',
      status: 'ACTIVE',
      features: ['STORY_GENERATION'],
      limits: { 'STORIES_PER_MONTH': 5 },
    }),
    getMonthlyUsage: jest.fn().mockResolvedValue(0),
  };

  const mockJobDispatcher = {
    dispatch: jest.fn().mockImplementation(async (type, data) => {
      if (type === 'story-generation') {
        try {
          await mockOrchestrator.generateStory(data.user, data.requestId);
          return { success: true, jobId: 'mock-job-id' };
        } catch (err: any) {
          return { success: false, jobId: 'mock-job-id', error: err.message };
        }
      }
      return { success: true, jobId: 'mock-job-id' };
    }),
    registerHandler: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: StoriesRepository, useValue: mockStoriesRepository },
        { provide: ChildrenAIContextService, useValue: mockAiContextService },
        { provide: ChildrenService, useValue: mockChildrenService },
        { provide: StoryGenerationOrchestrator, useValue: mockOrchestrator },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: UsageService, useValue: mockUsageService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: 'JobDispatcher', useValue: mockJobDispatcher },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createStory', () => {
    it('should create a story and orchestrate generation', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1' });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({
        id: 'req-1',
      });
      mockOrchestrator.generateStory.mockResolvedValueOnce({});
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: { id: 'req-1', status: StoryStatus.GENERATED },
        content: { title: 'Test Story', pages: [] },
      });

      const result = await service.createStory(mockUser, {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'courage',
        language: 'en',
        readingLevel: 'level_3',
      });

      expect(result.id).toBe('req-1');
      expect(mockChildrenService.getChild).toHaveBeenCalledWith(
        'user-1',
        'child-1',
      );
      expect(mockStoriesRepository.createRequest).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
        'level_3',
      );
      expect(mockOrchestrator.generateStory).toHaveBeenCalledWith(
        mockUser,
        'req-1',
      );
    });

    it('should fallback to ai context reading level', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1' });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({
        id: 'req-2',
      });
      mockAiContextService.buildContext.mockResolvedValueOnce({
        readingLevel: 'level_2',
      });
      mockOrchestrator.generateStory.mockResolvedValueOnce({});
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: { id: 'req-2', status: StoryStatus.GENERATED },
        content: { title: 'Test Story', pages: [] },
      });

      const result = await service.createStory(mockUser, {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'courage',
        language: 'en',
      });

      expect(result.id).toBe('req-2');
      expect(mockStoriesRepository.createRequest).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
        'level_2',
      );
    });

    it('should throw NotFoundException if child is invalid or not owned', async () => {
      mockChildrenService.getChild.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(
        service.createStory(mockUser, {
          childId: 'child-1',
          theme: 'space',
          selGoal: 'courage',
          language: 'en',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockStoriesRepository.createRequest).not.toHaveBeenCalled();
      expect(mockOrchestrator.generateStory).not.toHaveBeenCalled();
    });

    it('should throw if AI generation fails', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1' });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({
        id: 'req-3',
      });
      mockOrchestrator.generateStory.mockRejectedValueOnce(
        new Error('AI failed'),
      );

      await expect(
        service.createStory(mockUser, {
          childId: 'child-1',
          theme: 'space',
          selGoal: 'courage',
          language: 'en',
        }),
      ).rejects.toThrow('AI failed');
    });
  });

  describe('getStoriesByChild', () => {
    it('should return stories', async () => {
      mockStoriesRepository.findByChild.mockResolvedValueOnce([
        { id: 'story-1' },
      ]);

      const result = await service.getStoriesByChild(mockUser, 'child-1');
      expect(result.length).toBe(1);
    });
  });

  describe('getUserStories', () => {
    it('should return all user stories', async () => {
      mockStoriesRepository.findAllByUser.mockResolvedValueOnce([
        { id: 'story-1' },
      ]);

      const result = await service.getUserStories(mockUser);
      expect(result.length).toBe(1);
      expect(mockStoriesRepository.findAllByUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('getStoryById', () => {
    it('should return a story', async () => {
      mockStoriesRepository.findById.mockResolvedValueOnce({ id: 'story-1' });

      const result = await service.getStoryById(mockUser, 'story-1');
      expect(result.id).toBe('story-1');
    });
  });

  describe('getFullStoryById', () => {
    it('should return a combined full story', async () => {
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: {
          id: 'story-1',
          userId: 'user-1',
          childId: 'child-1',
          status: StoryStatus.GENERATED,
          theme: 'space',
          selGoal: 'focus',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        content: {
          title: 'The Great Space Journey',
          pages: [{ pageNumber: 1, text: 'Hello' }],
        },
      });

      const result = await service.getFullStoryById(mockUser, 'story-1');
      expect(result.id).toBe('story-1');
      expect(result.title).toBe('The Great Space Journey');
      expect(result.pages?.length).toBe(1);
      expect(result.metadata.theme).toBe('space');
    });
  });

  describe('updateStoryStatus', () => {
    it('should update and return a story', async () => {
      mockStoriesRepository.updateStatus.mockResolvedValueOnce({
        id: 'story-1',
        status: StoryStatus.GENERATING,
      });

      const result = await service.updateStoryStatus(
        mockUser,
        'story-1',
        StoryStatus.GENERATING,
      );
      expect(result.status).toBe(StoryStatus.GENERATING);
    });
  });

  describe('deleteStory', () => {
    it('should return true on delete', async () => {
      mockStoriesRepository.delete.mockResolvedValueOnce(true);

      const result = await service.deleteStory(mockUser, 'story-1');
      expect(result).toBe(true);
    });
  });

  describe('planStory', () => {
    it('should run plan and return blueprint', async () => {
      const dto = {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
        preferences: { customPrompt: 'Omar finds the lost star.' },
      };
      const mockPlan = { blueprint: { act1: 'intro' } };
      mockOrchestrator.planStory.mockResolvedValueOnce(mockPlan);

      const result = await service.planStory(mockUser, dto);
      expect(result).toEqual(mockPlan);
      expect(mockOrchestrator.planStory).toHaveBeenCalledWith(
        mockUser,
        'child-1',
        'en',
        'space',
        'focus',
        undefined,
        'Omar finds the lost star.',
      );
    });

    it('should throw if user is not allowed to access STORY_GENERATION', async () => {
      mockSubscriptionsService.canAccessFeature.mockResolvedValueOnce({
        allowed: false,
      });

      await expect(
        service.planStory(mockUser, {
          childId: 'child-1',
          theme: 'space',
          selGoal: 'focus',
          language: 'en',
        }),
      ).rejects.toThrow('Feature STORY_GENERATION is not enabled for your plan.');
    });
  });
});
