import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MediaGateway } from './gateway/media.gateway.js';
import { IllustrationService } from './illustration/illustration.service.js';
import { NotFoundException } from '@nestjs/common';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
describe('MediaService', () => {
  let service: MediaService;
  let supabaseService: SupabaseService;
  let mediaGateway: MediaGateway;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
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
      .mockResolvedValue({ allowed: true, current: 0, limit: 20 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MediaGateway,
          useValue: {
            generateMedia: jest
              .fn()
              .mockResolvedValue('http://test.com/media.png'),
          },
        },
        {
          provide: IllustrationService,
          useValue: {
            generateIllustrations: jest
              .fn()
              .mockResolvedValue('http://test.com/illustration.png'),
          },
        },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: UsageService, useValue: mockUsageService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    mediaGateway = module.get<MediaGateway>(MediaGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMediaRequest', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(
        service.createMediaRequest('invalid-id', 'ILLUSTRATION'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should insert a pending record and return mediaId', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1' },
        error: null,
      });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      });

      // Mock processMediaGeneration as it's async fire-and-forget
      jest
        .spyOn(service as any, 'processMediaGeneration')
        .mockImplementation(async () => {});

      const result = await service.createMediaRequest(
        'story-1',
        'ILLUSTRATION',
      );

      expect(result).toEqual({ mediaId: 'media-1', status: 'PENDING' });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('story_media');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });
  });

  describe('getMediaStatus', () => {
    it('should return the status of a media record', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { status: 'COMPLETED', url: 'http://test.com/img.png' },
        error: null,
      });

      const result = await service.getMediaStatus('media-1');
      expect(result).toEqual({
        status: 'COMPLETED',
        url: 'http://test.com/img.png',
      });
    });
  });

  describe('createIllustrationJob', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(
        service.createIllustrationJob('invalid-id', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should insert a pending illustration record and return status', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'user-1' },
        error: null,
      });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      });

      jest
        .spyOn(service as any, 'processMediaGeneration')
        .mockImplementation(async () => {});

      const result = await service.createIllustrationJob('story-1', 'user-1');

      expect(result).toEqual({ storyId: 'story-1', status: 'GENERATING' });
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ILLUSTRATION',
          provider: 'google',
        }),
      );
      expect(mockCreditsService.consumeCredits).toHaveBeenCalled();
    });

    it('should allow admin user on free plan with 0 credits without deducting credits', async () => {
      const adminUser: any = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        roles: ['admin'],
        permissions: [],
      };

      // Mock subscription feature access to return false (free plan)
      mockSubscriptionsService.canAccessFeature.mockResolvedValueOnce({
        allowed: false,
      });
      mockSubscriptionsService.checkLimit.mockResolvedValueOnce({
        allowed: false,
        current: 20,
        limit: 20,
      });
      mockCreditsService.getBalance.mockResolvedValueOnce({ balance: 0 });

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'admin-1' },
        error: null,
      });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      });

      jest
        .spyOn(service as any, 'processMediaGeneration')
        .mockImplementation(async () => {});

      const result = await service.createIllustrationJob('story-1', adminUser);

      expect(result).toEqual({ storyId: 'story-1', status: 'GENERATING' });
      // Credits should NOT be consumed for admin
      expect(mockCreditsService.consumeCredits).not.toHaveBeenCalled();
      // Usage tracking still happens
      expect(mockUsageService.trackUsage).toHaveBeenCalled();
    });

    it('should block non-admin user when feature is disabled for plan', async () => {
      const nonAdminUser: any = {
        id: 'user-normal',
        email: 'user@example.com',
        role: 'user',
        roles: ['user'],
        permissions: [],
      };

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'user-normal' },
        error: null,
      });

      mockSubscriptionsService.canAccessFeature.mockResolvedValueOnce({
        allowed: false,
      });

      await expect(
        service.createIllustrationJob('story-1', nonAdminUser),
      ).rejects.toThrow(
        'Feature ILLUSTRATION_GENERATION is not enabled for your plan.',
      );
    });

    it('should block non-admin user when zero credits remaining', async () => {
      const nonAdminUser: any = {
        id: 'user-normal',
        email: 'user@example.com',
        role: 'user',
        roles: ['user'],
        permissions: [],
      };

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'user-normal' },
        error: null,
      });

      mockSubscriptionsService.canAccessFeature.mockReset();
      mockSubscriptionsService.canAccessFeature.mockResolvedValue({
        allowed: true,
      });
      mockSubscriptionsService.checkLimit.mockReset();
      mockSubscriptionsService.checkLimit.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 20,
      });
      mockCreditsService.getBalance.mockResolvedValueOnce({ balance: 0 });

      await expect(
        service.createIllustrationJob('story-1', nonAdminUser),
      ).rejects.toThrow('Insufficient illustration credits');
    });

    it('should return existing job status without inserting duplicate row when job is already PENDING/PROCESSING/COMPLETED', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'user-1' },
        error: null,
      });

      jest.spyOn(service, 'getMediaForStory').mockResolvedValueOnce([
        {
          id: 'media-existing',
          type: 'ILLUSTRATION',
          status: 'PROCESSING',
          provider: 'google',
          created_at: '',
          metadata: {},
        },
      ]);

      const result = await service.createIllustrationJob('story-1', 'user-1');

      expect(result).toEqual({ storyId: 'story-1', status: 'GENERATING' });
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
      expect(mockCreditsService.consumeCredits).not.toHaveBeenCalled();
    });

    it('should still enforce story ownership check for admin user', async () => {
      const adminUser: any = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        roles: ['admin'],
        permissions: [],
      };

      // Story belongs to user-other
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'story-1', user_id: 'user-other' },
        error: null,
      });

      await expect(
        service.createIllustrationJob('story-1', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getIllustrations', () => {
    it('should throw NotFoundException if story is not found or owned by another user', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(service.getIllustrations('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map illustration records correctly with storyId and status metrics', async () => {
      jest.spyOn(service, 'getMediaForStory').mockResolvedValueOnce([
        {
          id: '1',
          type: 'ILLUSTRATION',
          status: 'COMPLETED',
          url: 'http://img.com',
          provider: 'google',
          created_at: '',
          metadata: {
            totalPages: 1,
            completedPages: 1,
            failedPages: 0,
            pages: [{ pageNumber: 1, imageUrl: 'http://img.com', status: 'COMPLETED' }],
          },
        },
      ]);

      const result = await service.getIllustrations('story-1');
      expect(result).toEqual({
        storyId: 'story-1',
        jobStatus: 'COMPLETED',
        totalPages: 1,
        completedPages: 1,
        failedPages: 0,
        illustrations: [
          {
            pageNumber: 1,
            imageUrl: 'http://img.com',
            status: 'COMPLETED',
          },
        ],
      });
    });

    it('should return NONE status if no illustration job exists for story', async () => {
      jest.spyOn(service, 'getMediaForStory').mockResolvedValueOnce([]);

      const result = await service.getIllustrations('story-1');
      expect(result).toEqual({
        storyId: 'story-1',
        jobStatus: 'NONE',
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: [],
      });
    });
  });
});
