import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

describe('SubscriptionsService Canonical Compatibility Tests', () => {
  let service: SubscriptionsService;

  const mockSupabaseBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    rpc: jest.fn(),
    then: jest.fn(),
  };

  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue(mockSupabaseBuilder),
    rpc: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            observeDatabaseQueryDuration: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Requirement 10: Canonical Subscription & Entitlement Scenarios', () => {
    it('1. Active free subscription recognized with all canonical features', async () => {
      // Mock user_subscriptions returning active free tier
      mockSupabaseBuilder.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'sub-free-1',
            user_id: 'user-free-1',
            plan_tier: 'free',
            status: 'active',
            starts_at: '2026-01-01T00:00:00Z',
            expires_at: null,
          },
        ],
        error: null,
      });

      // Mock subscription_plans returning canonical free plan details
      mockSupabaseBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          tier: 'free',
          monthly_story_limit: 30,
          daily_story_limit: 3,
          allow_illustrations: true,
          allow_pdf: true,
          allow_audio: true,
          illustration_credits: 20,
          active: true,
        },
        error: null,
      });

      const result = await service.getUserSubscription('user-free-1');
      expect(result.plan).toEqual('free');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
      expect(result.features).toContain('ILLUSTRATION_GENERATION');
      expect(result.features).toContain('REGENERATE_ILLUSTRATION');
      expect(result.features).toContain('PDF_EXPORT');
      expect(result.features).toContain('AUDIO_NARRATION');
      expect(result.limits['STORIES_PER_MONTH']).toEqual(30);
      expect(result.limits['STORIES_PER_DAY']).toEqual(3);
    });

    it('2. Uppercase canonical tier handling (e.g. FREE / PRO / PREMIUM)', async () => {
      mockSupabaseBuilder.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'sub-uppercase-1',
            user_id: 'user-uc-1',
            plan_tier: 'FREE',
            status: 'ACTIVE',
            starts_at: '2026-01-01T00:00:00Z',
            expires_at: null,
          },
        ],
        error: null,
      });

      mockSupabaseBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          tier: 'free',
          monthly_story_limit: 30,
          daily_story_limit: 3,
          allow_illustrations: true,
          allow_pdf: true,
          allow_audio: true,
          active: true,
        },
        error: null,
      });

      const result = await service.getUserSubscription('user-uc-1');
      expect(result.plan).toEqual('free');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
    });

    it('3. Free STORY_GENERATION allowed when quota available via checkStoryQuota RPC', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: {
          allowed: true,
          tier: 'free',
          daily_used: 1,
          daily_limit: 3,
          monthly_used: 5,
          monthly_limit: 30,
          reason: null,
        },
        error: null,
      });

      const quota = await service.checkStoryQuota('user-free-1');
      expect(quota.allowed).toBe(true);
      expect(quota.tier).toBe('free');
      expect(quota.reason).toBeNull();
    });

    it('4. Quota exceeded remains denied', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: {
          allowed: false,
          tier: 'free',
          daily_used: 3,
          daily_limit: 3,
          monthly_used: 10,
          monthly_limit: 30,
          reason: 'daily_limit_reached',
        },
        error: null,
      });

      const quota = await service.checkStoryQuota('user-free-quota');
      expect(quota.allowed).toBe(false);
      expect(quota.reason).toBe('daily_limit_reached');
    });

    it('5. Active paid subscription remains recognized', async () => {
      mockSupabaseBuilder.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'sub-parent-1',
            user_id: 'user-paid-1',
            plan_tier: 'parent',
            status: 'active',
            starts_at: '2026-01-01T00:00:00Z',
            expires_at: null,
          },
        ],
        error: null,
      });

      mockSupabaseBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          tier: 'parent',
          monthly_story_limit: 210,
          daily_story_limit: 7,
          allow_illustrations: true,
          allow_pdf: true,
          allow_audio: true,
          illustration_credits: 80,
          active: true,
        },
        error: null,
      });

      const result = await service.getUserSubscription('user-paid-1');
      expect(result.plan).toEqual('parent');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
      expect(result.limits['STORIES_PER_MONTH']).toEqual(210);
    });

    it('6. Expired paid subscription behavior (reverts to canonical free tier)', async () => {
      // Past expires_at date on paid tier
      mockSupabaseBuilder.limit.mockResolvedValue({
        data: [
          {
            id: 'sub-exp-1',
            user_id: 'user-exp-1',
            plan_tier: 'pro',
            status: 'active',
            starts_at: '2025-01-01T00:00:00Z',
            expires_at: '2025-02-01T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.getUserSubscription('user-exp-1');
      expect(result.plan).toEqual('free');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');

      const access = await service.canAccessFeature('user-exp-1', 'STORY_GENERATION');
      expect(access.allowed).toBe(true);
    });

    it('7. Missing subscription behavior (no row in user_subscriptions -> defaults to free tier)', async () => {
      mockSupabaseBuilder.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getUserSubscription('user-missing-1');
      expect(result.plan).toEqual('free');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
      expect(result.features).toContain('ILLUSTRATION_GENERATION');
      expect(result.features).toContain('PDF_EXPORT');
      expect(result.features).toContain('AUDIO_NARRATION');

      const access = await service.canAccessFeature('user-missing-1', 'STORY_GENERATION');
      expect(access.allowed).toBe(true);
    });

    it('8. Illustration/Audio/PDF entitlement checks share the same resolver', async () => {
      mockSupabaseBuilder.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      expect((await service.canAccessFeature('user-1', 'STORY_GENERATION')).allowed).toBe(true);
      expect((await service.canAccessFeature('user-1', 'ILLUSTRATION_GENERATION')).allowed).toBe(true);
      expect((await service.canAccessFeature('user-1', 'REGENERATE_ILLUSTRATION')).allowed).toBe(true);
      expect((await service.canAccessFeature('user-1', 'PDF_EXPORT')).allowed).toBe(true);
      expect((await service.canAccessFeature('user-1', 'AUDIO_NARRATION')).allowed).toBe(true);
    });
  });

  describe('Fallback Story Quota & Admin Bypass Checks', () => {
    it('should calculate quota fallback correctly when RPC fails', async () => {
      // RPC throws error
      mockSupabaseClient.rpc.mockRejectedValueOnce(new Error('RPC missing'));

      // user subscription is active free
      jest.spyOn(service, 'getUserSubscription').mockResolvedValueOnce({
        plan: 'free',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: { STORIES_PER_DAY: 3, STORIES_PER_MONTH: 30 },
      });

      // getMonthlyUsage returns 2 stories
      jest.spyOn(service, 'getMonthlyUsage').mockResolvedValueOnce(2);

      // daily story count returns 1 story
      mockSupabaseBuilder.then.mockImplementationOnce((cb) => cb({ count: 1 }));

      const quota = await service.checkStoryQuota('user-fallback-1');
      expect(quota.allowed).toBe(true);
      expect(quota.daily_used).toBe(1);
      expect(quota.monthly_used).toBe(2);
    });

    it('should bypass story quota when userContext is admin or super_admin', async () => {
      const adminCtx: any = { roles: ['admin'] };
      const quota = await service.checkStoryQuota('admin-user-id', adminCtx);
      expect(quota.allowed).toBe(true);
      expect(quota.tier).toBe('admin');
      expect(quota.daily_limit).toBe(999999);
      expect(quota.monthly_limit).toBe(999999);
    });
  });
});

