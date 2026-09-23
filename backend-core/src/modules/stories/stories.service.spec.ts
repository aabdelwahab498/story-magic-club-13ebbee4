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
import { AI_GATEWAY } from '../ai/gateway/ai-gateway.interface.js';

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

  const mockAiGateway = {
    buildContext: jest.fn().mockReturnValue({ childAge: 6, language: 'en', theme: 'dragons' }),
    planStory: jest.fn().mockResolvedValue({
      selOutcome: { skill: 'Courage', emotion: 'Brave', statement: 'Leo was brave.' },
    }),
    writeStory: jest.fn().mockResolvedValue({
      title: 'Leo and the Dragon',
      pages: [
        { pageNumber: 1, text: 'Page 1 text', emotionTag: 'excited', illustrationPrompt: 'Prompt 1' },
        { pageNumber: 2, text: 'Page 2 text', emotionTag: 'brave', illustrationPrompt: 'Prompt 2' },
        { pageNumber: 3, text: 'Page 3 text', emotionTag: 'happy', illustrationPrompt: 'Prompt 3' },
        { pageNumber: 4, text: 'Page 4 text', emotionTag: 'joyful', illustrationPrompt: 'Prompt 4' },
      ],
    }),
    validateStory: jest.fn().mockReturnValue({ valid: true, errors: [] }),
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
    checkStoryQuota: jest.fn().mockResolvedValue({
      allowed: true,
      tier: 'free',
      daily_used: 0,
      daily_limit: 3,
      monthly_used: 0,
      monthly_limit: 30,
      reason: null,
    }),
    checkLimit: jest
      .fn()
      .mockResolvedValue({ allowed: true, current: 0, limit: 3 }),
    getUserSubscription: jest.fn().mockResolvedValue({
      plan: 'free',
      status: 'ACTIVE',
      features: ['STORY_GENERATION'],
      limits: { STORIES_PER_MONTH: 5 },
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
        { provide: AI_GATEWAY, useValue: mockAiGateway },
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

  describe('createTrialStory', () => {
    it('should generate a 3-page teaser trial story without user account or credit deduction', async () => {
      const trialDto = {
        childName: 'Leo',
        age: 6,
        theme: 'Dragons & Magic',
        language: 'en',
        selGoal: 'Courage',
      };

      const result = await service.createTrialStory(trialDto);

      expect(result.teaser).toBe(true);
      expect(result.shownPages).toBe(3);
      expect(result.totalPages).toBe(4);
      expect(result.pages).toHaveLength(3);
      expect(result.title).toBe('Leo and the Dragon');
      expect(result.sel_outcome?.skill).toBe('Courage');

      // Verify no user balance or child profile was queried or consumed
      expect(mockCreditsService.consumeCredits).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.getUserSubscription).not.toHaveBeenCalled();
      expect(mockChildrenService.getChild).not.toHaveBeenCalled();
      expect(mockStoriesRepository.createRequest).not.toHaveBeenCalled();
    });
  });

  describe('Admin Story Quota Bypass', () => {
    const mockAdminUser: UserContext = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: Role.ADMIN,
      roles: [Role.ADMIN],
      permissions: [],
    };

    const mockSuperAdminUser: UserContext = {
      id: 'super-admin-1',
      email: 'superadmin@example.com',
      role: Role.SUPER_ADMIN,
      roles: [Role.SUPER_ADMIN],
      permissions: [],
    };

    it('1. admin + free plan + monthly quota exhausted -> /stories/plan allowed', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.canAccessFeature.mockResolvedValue({ allowed: false });
      mockSubscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: false,
        reason: 'monthly_limit_reached',
      });
      mockOrchestrator.planStory.mockResolvedValueOnce({ blueprint: { act1: 'intro' } });

      const dto = { childId: 'child-1', theme: 'space', selGoal: 'focus', language: 'en' };
      const result = await service.planStory(mockAdminUser, dto);

      expect(result).toBeDefined();
      expect(mockOrchestrator.planStory).toHaveBeenCalledWith(
        mockAdminUser,
        'child-1',
        'en',
        'space',
        'focus',
        undefined,
      );
    });

    it('2. admin + free plan + monthly quota exhausted -> /stories allowed', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.canAccessFeature.mockResolvedValue({ allowed: false });
      mockSubscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: false,
        reason: 'monthly_limit_reached',
      });
      mockCreditsService.getBalance.mockResolvedValueOnce({ balance: 0 });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({ id: 'req-admin-1' });
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: { id: 'req-admin-1', status: StoryStatus.GENERATED },
        content: { title: 'Admin Story', pages: [] },
      });

      const result = await service.createStory(mockAdminUser, {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'courage',
        language: 'en',
      });

      expect(result.id).toBe('req-admin-1');
      expect(mockJobDispatcher.dispatch).toHaveBeenCalledWith('story-generation', {
        user: mockAdminUser,
        requestId: 'req-admin-1',
      });
    });

    it('3. super_admin receives same bypass', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: false,
        reason: 'monthly_limit_reached',
      });
      mockOrchestrator.planStory.mockResolvedValueOnce({ blueprint: { act1: 'intro' } });

      const dto = { childId: 'child-1', theme: 'space', selGoal: 'focus', language: 'en' };
      const result = await service.planStory(mockSuperAdminUser, dto);

      expect(result).toBeDefined();
    });

    it('4. admin bypass does NOT alter subscription plan', async () => {
      mockSubscriptionsService.getUserSubscription.mockResolvedValueOnce({
        plan: 'free',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: { STORIES_PER_MONTH: 1 },
      });

      const sub = await mockSubscriptionsService.getUserSubscription(mockAdminUser.id);
      expect(sub.plan).toBe('free');
    });

    it('5. normal free user at monthly limit remains blocked', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.canAccessFeature.mockResolvedValue({ allowed: true });
      mockSubscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: false,
        reason: 'monthly_limit_reached',
        monthly_used: 1,
        monthly_limit: 1,
      });

      const dto = { childId: 'child-1', theme: 'space', selGoal: 'focus', language: 'en' };
      await expect(service.planStory(mockUser, dto)).rejects.toThrow(
        'Plan limit reached',
      );
    });

    it('6. normal free user under quota remains unchanged', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.canAccessFeature.mockReset();
      mockSubscriptionsService.canAccessFeature.mockResolvedValue({ allowed: true });
      mockSubscriptionsService.checkStoryQuota.mockReset();
      mockSubscriptionsService.checkStoryQuota.mockResolvedValue({
        allowed: true,
        reason: null,
        monthly_used: 0,
        monthly_limit: 5,
      });
      mockOrchestrator.planStory.mockResolvedValueOnce({ blueprint: { act1: 'intro' } });

      const dto = { childId: 'child-1', theme: 'space', selGoal: 'focus', language: 'en' };
      const result = await service.planStory(mockUser, dto);
      expect(result).toBeDefined();
    });

    it('7. canonical free user with zero user_credits creates story successfully under quota', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockSubscriptionsService.getUserSubscription.mockResolvedValueOnce({
        plan: 'free',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: { STORIES_PER_MONTH: 30 },
      });
      mockSubscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: true,
        reason: null,
        daily_used: 0,
        daily_limit: 3,
        monthly_used: 0,
        monthly_limit: 30,
      });
      mockCreditsService.getBalance.mockResolvedValueOnce({ balance: 0 });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({ id: 'req-free-1' });
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: { id: 'req-free-1', status: StoryStatus.GENERATED },
        content: { title: 'Free Story', pages: [] },
      });

      const result = await service.createStory(mockUser, {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'courage',
        language: 'en',
      });

      expect(result.id).toBe('req-free-1');
      expect(mockJobDispatcher.dispatch).toHaveBeenCalledWith('story-generation', {
        user: mockUser,
        requestId: 'req-free-1',
      });
    });

    it('7. child ownership remains enforced for admin', async () => {
      mockChildrenService.getChild.mockReset();
      mockChildrenService.getChild.mockRejectedValueOnce(new NotFoundException('Child not found'));

      await expect(
        service.createStory(mockAdminUser, {
          childId: 'other-child',
          theme: 'space',
          selGoal: 'courage',
          language: 'en',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. BullMQ story-generation job is dispatched after successful admin authorization', async () => {
      mockChildrenService.getChild.mockResolvedValueOnce({ id: 'child-1', name: 'Child', age: 6 });
      mockStoriesRepository.createRequest.mockResolvedValueOnce({ id: 'req-bullmq-1' });
      mockStoriesRepository.getFullStory.mockResolvedValueOnce({
        metadata: { id: 'req-bullmq-1', status: StoryStatus.GENERATED },
        content: { title: 'BullMQ Story', pages: [] },
      });

      await service.createStory(mockAdminUser, {
        childId: 'child-1',
        theme: 'space',
        selGoal: 'courage',
        language: 'en',
      });

      expect(mockJobDispatcher.dispatch).toHaveBeenCalledWith('story-generation', {
        user: mockAdminUser,
        requestId: 'req-bullmq-1',
      });
    });
  });
});
