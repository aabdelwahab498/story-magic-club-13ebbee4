import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

import { MetricsService } from '../metrics/metrics.service.js';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const mockSupabaseBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    then: jest.fn(),
  };

  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue(mockSupabaseBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSupabaseBuilder.then.mockImplementation((cb) =>
      cb({ data: null, error: null }),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserSubscription', () => {
    it('should return subscription details', async () => {
      mockSupabaseBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          status: 'ACTIVE',
          plan_id: 'plan-1',
          subscription_plans: {
            slug: 'PREMIUM',
            plan_features: [{ feature_key: 'STORY_GENERATION', enabled: true }],
            plan_limits: [],
          },
        },
        error: null,
      });

      const result = await service.getUserSubscription('user-1');
      expect(result.plan).toEqual('PREMIUM');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
    });

    it('should fallback to FREE if no active subscription', async () => {
      mockSupabaseBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      mockSupabaseBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'free-plan-id',
          slug: 'FREE',
          plan_features: [{ feature_key: 'STORY_GENERATION', enabled: true }],
          plan_limits: [],
        },
        error: null,
      });

      const result = await service.getUserSubscription('user-1');
      expect(result.plan).toEqual('FREE');
      expect(result.status).toEqual('ACTIVE');
      expect(result.features).toContain('STORY_GENERATION');
    });
  });

  describe('canAccessFeature', () => {
    it('should return allowed if feature is enabled', async () => {
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue({
        plan: 'FREE',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: {},
      });

      const result = await service.canAccessFeature(
        'user-1',
        'STORY_GENERATION',
      );
      expect(result.allowed).toBe(true);
    });

    it('should return not allowed if feature is disabled', async () => {
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue({
        plan: 'FREE',
        status: 'ACTIVE',
        features: ['STORY_GENERATION'],
        limits: {},
      });

      const result = await service.canAccessFeature('user-1', 'PDF_EXPORT');
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkLimit', () => {
    it('should allow if limit is not exceeded', async () => {
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue({
        plan: 'FREE',
        status: 'ACTIVE',
        features: [],
        limits: { 'STORIES_PER_MONTH': 3 },
      });

      mockSupabaseBuilder.then.mockImplementationOnce((cb) => cb({ count: 1 }));

      const result = await service.checkLimit('user-1', 'STORIES_PER_MONTH');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(3);
    });

    it('should deny if limit is exceeded', async () => {
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue({
        plan: 'FREE',
        status: 'ACTIVE',
        features: [],
        limits: { 'STORIES_PER_MONTH': 3 },
      });

      mockSupabaseBuilder.then.mockImplementationOnce((cb) => cb({ count: 3 }));

      const result = await service.checkLimit('user-1', 'STORIES_PER_MONTH');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
    });
  });
});
