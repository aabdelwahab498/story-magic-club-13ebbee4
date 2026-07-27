import { Test, TestingModule } from '@nestjs/testing';
import { IllustratedStoryExportService } from './illustrated-story-export.service.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { PdfExportService } from '../../pdf/pdf.service.js';
import { CreditsService } from '../../credits/credits.service.js';
import { UsageService } from '../../usage/usage.service.js';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import { NotFoundException } from '@nestjs/common';

describe('IllustratedStoryExportService', () => {
  let service: IllustratedStoryExportService;
  let mockSupabaseService: any;
  let mockPdfExportService: any;
  let mockCreditsService: any;
  let mockUsageService: any;
  let mockSubscriptionsService: any;
  let mockMetricsService: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IllustratedStoryExportService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: PdfExportService, useValue: mockPdfExportService },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: UsageService, useValue: mockUsageService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: MetricsService, useValue: mockMetricsService },
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

  describe('exportStoryPdf', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'stories') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(service.exportStoryPdf('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return PDF signed URL on success', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'story-1',
                    user_id: 'user-1',
                    title: 'Test Story',
                    generated_story: { pages: [{ text: 'Once upon a time' }] },
                    language: 'en',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.exportStoryPdf('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/story.pdf');
    });
  });

  describe('exportStoryAudio', () => {
    it('should throw NotFoundException if audio is not generated', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'story-1',
                    user_id: 'user-1',
                    title: 'Test Story',
                    generated_story: { pages: [{ text: 'Once upon a time' }] },
                    audio_url: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      await expect(service.exportStoryAudio('story-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return audio download URL when audio exists', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'story-1',
                    user_id: 'user-1',
                    title: 'Test Story',
                    generated_story: { pages: [{ text: 'Once upon a time' }] },
                    audio_url: 'http://test.com/audio.mp3',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const res = await service.exportStoryAudio('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/audio.mp3');
      expect(res.filename).toBe('story.mp3');
    });
  });

  describe('exportStoryZip', () => {
    it('should return ZIP download URL on success', async () => {
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ai_story_history') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'story-1',
                    user_id: 'user-1',
                    title: 'Test Story',
                    generated_story: { pages: [{ text: 'Once upon a time' }] },
                    language: 'en',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'story_media') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await service.exportStoryZip('story-1', 'user-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.download_url).toBe('http://test.com/zip');
      expect(res.filename).toBe('story-bundle.zip');
    });
  });
});
