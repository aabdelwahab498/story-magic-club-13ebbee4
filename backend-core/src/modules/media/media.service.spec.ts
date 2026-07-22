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
    single: jest.fn().mockReturnThis(),
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
          },
        },
        {
          provide: MediaGateway,
          useValue: {
            generateMedia: jest.fn(),
          },
        },
        {
          provide: IllustrationService,
          useValue: {
            generateIllustrations: jest.fn(),
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
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(
        service.createMediaRequest('invalid-id', 'ILLUSTRATION'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should insert a pending record and return mediaId', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'story-1' }, error: null }) // select story
        .mockResolvedValueOnce({ data: { id: 'media-1' }, error: null }); // insert media

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
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      await expect(service.createIllustrationJob('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should insert a pending illustration record and return status', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'story-1' }, error: null }) // select story
        .mockResolvedValueOnce({ data: { id: 'media-1' }, error: null }); // insert media

      jest
        .spyOn(service as any, 'processMediaGeneration')
        .mockImplementation(async () => {});

      const result = await service.createIllustrationJob('story-1', 'user-1');

      expect(result).toEqual({ storyId: 'story-1', status: 'GENERATING' });
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ILLUSTRATION' }),
      );
    });
  });

  describe('getIllustrations', () => {
    it('should map illustration records correctly', async () => {
      jest.spyOn(service, 'getMediaForStory').mockResolvedValueOnce([
        {
          id: '1',
          type: 'ILLUSTRATION',
          status: 'COMPLETED',
          url: 'http://img.com',
          provider: 'google',
          created_at: '',
          metadata: { illustration: { pageNumber: 1 } },
        },
        {
          id: '2',
          type: 'AUDIO',
          status: 'COMPLETED',
          url: 'http://audio.com',
          provider: 'mock',
          created_at: '',
          metadata: {},
        },
      ]);

      const result = await service.getIllustrations('story-1');
      expect(result.jobStatus).toBe('COMPLETED');
      expect(result.illustrations).toHaveLength(1);
      expect(result.illustrations[0]).toEqual({
        pageNumber: 1,
        imageUrl: 'http://img.com',
        status: 'COMPLETED',
      });
    });
  });
});
