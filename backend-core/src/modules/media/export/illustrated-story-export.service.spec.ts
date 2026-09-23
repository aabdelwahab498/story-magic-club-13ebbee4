import { Test, TestingModule } from '@nestjs/testing';
import { IllustratedStoryExportService } from './illustrated-story-export.service.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PdfExportService } from '../../pdf/pdf.service.js';
import { CreditsService } from '../../credits/credits.service.js';
import { UsageService } from '../../usage/usage.service.js';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import { ConfigService } from '@nestjs/config';
import { MediaService } from '../media.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('IllustratedStoryExportService', () => {
  let service: IllustratedStoryExportService;
  let mockSupabaseService: any;
  let mockPdfExportService: any;
  let mockCreditsService: any;
  let mockUsageService: any;
  let mockSubscriptionsService: any;
  let mockMetricsService: any;
  let mockConfigService: any;
  let mockMediaService: any;

  const mockClient = {
    from: jest.fn(),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest
          .fn()
          .mockResolvedValue({ data: { signedUrl: 'http://test.com/zip' }, error: null }),
      }),
    },
  };

  beforeEach(async () => {
    mockSupabaseService = {
      getAdminClient: jest.fn().mockReturnValue(mockClient),
      getUserClient: jest.fn().mockReturnValue(mockClient),
    };

    mockPdfExportService = {
      exportStoryPdf: jest.fn().mockResolvedValue('http://test.com/story.pdf'),
    };

    mockCreditsService = {
      getBalance: jest.fn().mockResolvedValue({ balance: 100 }),
      consumeCredits: jest.fn().mockResolvedValue(true),
    };

    mockUsageService = {
      trackUsage: jest.fn(),
    };

    mockSubscriptionsService = {
      canAccessFeature: jest.fn().mockResolvedValue({ allowed: true }),
    };

    mockMetricsService = {
      observeFileProcessingDuration: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('story-pdfs'),
    };

    mockMediaService = {
      createIllustrationJob: jest.fn().mockResolvedValue({ status: 'GENERATING' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IllustratedStoryExportService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: PdfExportService, useValue: mockPdfExportService },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: UsageService, useValue: mockUsageService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<IllustratedStoryExportService>(IllustratedStoryExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const createTableChain = (data: any) => ({
    select: jest.fn().mockReturnValue({
      or: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
      }),
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  });

  describe('exportStoryPdf', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockClient.from.mockReturnValue(createTableChain(null));

      await expect(service.exportStoryPdf('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return WAITING_FOR_ILLUSTRATIONS if no illustration job exists yet', async () => {
      const canonicalStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'Test Story',
        generated_story: { pages: [{ text: 'Once upon a time' }] },
      };
      const requestData = { user_id: 'user-1', language: 'en' };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return createTableChain(null);
      });

      const res = await service.exportStoryPdf('story-1', 'user-1');
      expect(res.status).toBe('WAITING_FOR_ILLUSTRATIONS');
      expect(mockMediaService.createIllustrationJob).toHaveBeenCalledWith('story-1', 'user-1');
    });

    it('should return WAITING_FOR_ILLUSTRATIONS if illustrations are PROCESSING', async () => {
      const canonicalStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'Test Story',
        generated_story: { pages: [{ text: 'Once upon a time' }] },
      };
      const requestData = { user_id: 'user-1', language: 'en' };
      const mediaData = [{ type: 'ILLUSTRATION', status: 'PROCESSING', metadata: {} }];

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mediaData, error: null }),
            }),
          };
        }
        return createTableChain(null);
      });

      const res = await service.exportStoryPdf('story-1', 'user-1');
      expect(res.status).toBe('WAITING_FOR_ILLUSTRATIONS');
    });

    it('should throw BadRequestException if illustrations terminally FAILED', async () => {
      const canonicalStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'Test Story',
        generated_story: { pages: [{ text: 'Once upon a time' }] },
      };
      const requestData = { user_id: 'user-1', language: 'en' };
      const mediaData = [{ type: 'ILLUSTRATION', status: 'FAILED', metadata: {} }];

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mediaData, error: null }),
            }),
          };
        }
        return createTableChain(null);
      });

      await expect(service.exportStoryPdf('story-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return PDF signed URL on COMPLETED illustrations', async () => {
      const canonicalStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'Test Story',
        generated_story: { pages: [{ text: 'Once upon a time' }] },
      };
      const requestData = { user_id: 'user-1', language: 'en' };
      const mediaData = [
        {
          type: 'ILLUSTRATION',
          status: 'COMPLETED',
          metadata: { pages: [{ pageNumber: 1, imageUrl: 'http://test.com/img1.png', status: 'COMPLETED' }] },
        },
      ];

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mediaData, error: null }),
            }),
          };
        }
        return createTableChain(null);
      });

      const res = await service.exportStoryPdf('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/story.pdf');
      expect(mockPdfExportService.exportStoryPdf).toHaveBeenCalledWith(
        'story-1',
        expect.any(Array),
        expect.objectContaining({ title: 'Test Story' }),
        'user-1',
      );
    });

    it('should reject PDF export if caller userId does not match story owner', async () => {
      const canonicalStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'User 1 Story',
        generated_story: { pages: [{ text: 'Content' }] },
      };
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        return createTableChain(null);
      });

      // User-2 attempts to export User-1's story
      await expect(service.exportStoryPdf('story-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exportStoryTxt', () => {
    it('should throw NotFoundException if story does not exist or user is not owner', async () => {
      mockClient.from.mockReturnValue(createTableChain(null));

      await expect(service.exportStoryTxt('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should format English story text preserving page order and UTF-8', async () => {
      const canonicalStory = {
        id: 'story-1',
        request_id: 'req-1',
        title: 'The Brave Astronaut',
        pages: [{ text: 'Page 1 text' }, { text: 'Page 2 text' }],
      };
      const requestData = { user_id: 'user-1', language: 'en' };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        return createTableChain(null);
      });

      const res = await service.exportStoryTxt('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.filename).toBe('The_Brave_Astronaut.txt');
      expect(res.content).toContain('The Brave Astronaut');
      expect(res.content).toContain('[Page 1]\nPage 1 text');
      expect(res.content).toContain('[Page 2]\nPage 2 text');
    });

    it('should format Arabic story text correctly preserving UTF-8 Unicode', async () => {
      const canonicalStory = {
        id: 'story-2',
        request_id: 'req-2',
        title: 'رحلة إلى القمر',
        pages: [{ text: 'في قديم الزمان كانت هناك أميرة مغامرة.' }],
      };
      const requestData = { user_id: 'user-1', language: 'ar' };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        return createTableChain(null);
      });

      const res = await service.exportStoryTxt('story-2', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.filename).toContain('رحلة_إلى_القمر.txt');
      expect(res.content).toContain('رحلة إلى القمر');
      expect(res.content).toContain('في قديم الزمان كانت هناك أميرة مغامرة.');
    });
  });

  describe('exportStoryAudio', () => {
    it('should throw NotFoundException if audio is not generated', async () => {
      const canonicalStory = {
        id: 'story-1',
        request_id: 'req-1',
        title: 'Test Story',
        pages: [{ text: 'Once upon a time' }],
      };
      const requestData = { user_id: 'user-1', language: 'en' };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'stories') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return createTableChain(null);
      });

      await expect(service.exportStoryAudio('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return audio download URL when audio exists', async () => {
      const legacyStory = {
        id: 'story-1',
        user_id: 'user-1',
        title: 'Test Story',
        generated_story: { pages: [{ text: 'Once upon a time' }] },
        audio_url: 'http://test.com/audio.mp3',
      };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'stories') return createTableChain(null);
        if (table === 'ai_story_history') return createTableChain(legacyStory);
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return createTableChain(null);
      });

      const res = await service.exportStoryAudio('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/audio.mp3');
      expect(res.filename).toBe('Test_Story.mp3');
    });
  });

  describe('exportStoryZip', () => {
    it('should return ZIP download URL on success', async () => {
      const canonicalStory = {
        id: 'story-1',
        request_id: 'req-1',
        title: 'Test Story',
        pages: [{ text: 'Once upon a time' }],
      };
      const requestData = { user_id: 'user-1', language: 'en' };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') return createTableChain(canonicalStory);
        if (table === 'story_requests') return createTableChain(requestData);
        return createTableChain(null);
      });

      const res = await service.exportStoryZip('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/zip');
      expect(res.filename).toBe('story-bundle.zip');
    });
  });
});
