import { Test, TestingModule } from '@nestjs/testing';
import { StoriesRepository } from './repositories/stories.repository.js';
import { StoriesService } from './stories.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { ChildrenService } from '../children/children.service.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import { AI_GATEWAY } from '../ai/gateway/ai-gateway.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';

describe('Authenticated Story Request Creation RLS & Entitlements', () => {
  let storiesRepository: StoriesRepository;
  let storiesService: StoriesService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockUserClient: any;
  let mockAnonClient: any;

  const mockUser: UserContext = {
    id: 'authenticated-user-uuid-1234',
    email: 'caller@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  beforeEach(async () => {
    mockUserClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      eq: jest.fn().mockReturnThis(),
    };

    mockAnonClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      eq: jest.fn().mockReturnThis(),
    };

    supabaseService = {
      getClient: jest.fn().mockReturnValue(mockAnonClient),
      getUserClient: jest.fn().mockReturnValue(mockUserClient),
    } as unknown as jest.Mocked<SupabaseService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesRepository,
        StoriesService,
        { provide: SupabaseService, useValue: supabaseService },
        {
          provide: ChildrenService,
          useValue: { getChild: jest.fn().mockResolvedValue({ id: 'c1', name: 'Omar', age: 7 }) },
        },
        {
          provide: ChildrenAIContextService,
          useValue: { buildContext: jest.fn().mockResolvedValue({ readingLevel: 'level_2' }) },
        },
        {
          provide: CreditsService,
          useValue: { deductCredits: jest.fn(), getBalance: jest.fn() },
        },
        { provide: UsageService, useValue: { logUsage: jest.fn() } },
        {
          provide: SubscriptionsService,
          useValue: {
            getUserSubscription: jest.fn().mockResolvedValue({ features: ['STORY_GENERATION'] }),
            checkStoryQuota: jest.fn().mockResolvedValue({ allowed: true }),
          },
        },
        { provide: StoryGenerationOrchestrator, useValue: {} },
        { provide: AI_GATEWAY, useValue: {} },
        {
          provide: 'JobDispatcher',
          useValue: { dispatch: jest.fn().mockResolvedValue({ success: true, jobId: 'job-1' }) },
        },
      ],
    }).compile();

    storiesRepository = module.get<StoriesRepository>(StoriesRepository);
    storiesService = module.get<StoriesService>(StoriesService);
  });

  describe('Requirement A & B: User-scoped Supabase client for story_requests INSERT', () => {
    it('A. createRequest invokes getUserClient and NOT the anonymous getClient', async () => {
      mockUserClient.single.mockResolvedValueOnce({
        data: {
          id: 'req-uuid-9999',
          user_id: mockUser.id,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const res = await storiesRepository.createRequest(
        mockUser.id,
        { childName: 'Omar', age: 7, theme: 'Adventure', selGoal: 'Courage', language: 'en' },
        'level_2',
      );

      expect(supabaseService.getUserClient).toHaveBeenCalled();
      expect(supabaseService.getClient).not.toHaveBeenCalled();
      expect(mockUserClient.from).toHaveBeenCalledWith('story_requests');
      expect(mockAnonClient.from).not.toHaveBeenCalledWith('story_requests');
      expect(res.id).toBe('req-uuid-9999');
    });

    it('C. caller ownership user_id is locked to authenticated caller ID', async () => {
      mockUserClient.single.mockResolvedValueOnce({
        data: {
          id: 'req-uuid-8888',
          user_id: mockUser.id,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      await storiesRepository.createRequest(
        mockUser.id,
        { childName: 'Omar', age: 7, theme: 'Adventure', selGoal: 'Courage', language: 'en' },
        'level_2',
      );

      expect(mockUserClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
        }),
      );
    });

    it('D. RLS failure is not silently swallowed and throws InternalServerErrorException', async () => {
      mockUserClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy for table "story_requests"' },
      });

      await expect(
        storiesRepository.createRequest(
          mockUser.id,
          { childName: 'Omar', age: 7, theme: 'Adventure', selGoal: 'Courage', language: 'en' },
          'level_2',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Requirement E: Entitlement and Quota Error Mapping', () => {
    it('throws ForbiddenException when STORY_GENERATION feature is disabled', async () => {
      const subscriptionsService = (storiesService as any).subscriptionsService;
      subscriptionsService.getUserSubscription.mockResolvedValueOnce({ features: [] });

      await expect(
        storiesService.createStory(mockUser, {
          childName: 'Omar',
          age: 7,
          theme: 'Adventure',
          selGoal: 'Courage',
          language: 'en',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 429 TOO_MANY_REQUESTS when daily story quota is exceeded', async () => {
      const subscriptionsService = (storiesService as any).subscriptionsService;
      subscriptionsService.checkStoryQuota.mockResolvedValueOnce({
        allowed: false,
        reason: 'daily_limit_reached',
        daily_used: 5,
        daily_limit: 5,
      });

      try {
        await storiesService.createStory(mockUser, {
          childName: 'Omar',
          age: 7,
          theme: 'Adventure',
          selGoal: 'Courage',
          language: 'en',
        });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });

  describe('Requirement F: Story Text Generation Credit Isolation', () => {
    it('creates story request without requiring or deducting illustration credits', async () => {
      const creditsService = (storiesService as any).creditsService;
      mockUserClient.single.mockResolvedValueOnce({
        data: {
          id: 'req-uuid-7777',
          user_id: mockUser.id,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock getFullStoryById
      jest.spyOn(storiesService as any, 'getFullStoryById').mockResolvedValueOnce({
        id: 'req-uuid-7777',
        childId: null,
        status: 'draft',
        language: 'en',
        theme: 'Adventure',
        selGoal: 'Courage',
        readingLevel: 'level_2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await storiesService.createStory(mockUser, {
        childName: 'Omar',
        age: 7,
        theme: 'Adventure',
        selGoal: 'Courage',
        language: 'en',
      });

      expect(res.id).toBe('req-uuid-7777');
      expect(creditsService.deductCredits).not.toHaveBeenCalled();
    });
  });
});
