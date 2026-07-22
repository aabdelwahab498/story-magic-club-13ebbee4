// backend-core/src/modules/media/audio.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AudioService } from './audio.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { AudioProviderFactory } from './providers/audio/audio-provider.factory.js';
import { NotFoundException } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service.js';

describe('AudioService', () => {
  let service: AudioService;
  let supabaseService: SupabaseService;
  let providerFactory: AudioProviderFactory;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  };

  const mockAudioProvider = {
    name: 'mock-audio',
    generate: jest.fn().mockResolvedValue('https://mock-url.mp3'),
  };

  const mockProviderFactory = {
    getProvider: jest.fn().mockReturnValue(mockAudioProvider),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: AudioProviderFactory,
          useValue: mockProviderFactory,
        },
        {
          provide: MetricsService,
          useValue: {
            observeFileProcessingDuration: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AudioService>(AudioService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    providerFactory = module.get<AudioProviderFactory>(AudioProviderFactory);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNarration', () => {
    it('should throw NotFoundException if story does not exist', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(service.generateNarration('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create a new pending media request if none exists and run background processing', async () => {
      const storyData = {
        id: 'story-1',
        pages: [{ text: 'Once upon a time' }],
        language: 'en',
      };

      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: storyData, error: null }) // story check
        .mockResolvedValueOnce({ data: null, error: null }); // existing media check

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'media-1', status: 'PENDING' },
        error: null,
      });

      const result = await service.generateNarration('story-1');

      expect(result).toEqual({ mediaId: 'media-1', status: 'PENDING' });
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          story_id: 'story-1',
          type: 'AUDIO',
          status: 'PENDING',
        }),
      );

      // Verify background task starts and calls provider
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockAudioProvider.generate).toHaveBeenCalledWith('story-1', {
        text: 'Once upon a time',
        language: 'en',
      });
    });
  });

  describe('getNarration', () => {
    it('should return COMPLETED and url if story has audio_url', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { audio_url: 'https://test.mp3' },
        error: null,
      });

      const result = await service.getNarration('story-1');
      expect(result).toEqual({
        status: 'COMPLETED',
        audioUrl: 'https://test.mp3',
      });
    });

    it('should check story_media status if no audio_url exists', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: { audio_url: null }, error: null }) // story
        .mockResolvedValueOnce({ data: { status: 'PROCESSING' }, error: null }); // media status

      const result = await service.getNarration('story-1');
      expect(result).toEqual({
        status: 'PROCESSING',
        audioUrl: null,
        error: null,
      });
    });
  });

  describe('deleteNarration', () => {
    it('should clear DB column and delete media record', async () => {
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({ error: null });
      mockSupabaseClient.delete.mockReturnThis();

      const result = await service.deleteNarration('story-1');
      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({ audio_url: null }),
      );
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
    });
  });

  describe('synthesizeTts', () => {
    it('should invoke narrate-story edge function', async () => {
      const mockInvoke = jest.fn().mockResolvedValueOnce({
        data: { audioContent: 'base64audio' },
        error: null,
      });
      jest.spyOn(supabaseService, 'getAdminClient').mockReturnValue({
        functions: { invoke: mockInvoke },
      } as any);

      const result = await service.synthesizeTts('hello', 'en', 'narrator');

      expect(mockInvoke).toHaveBeenCalledWith('narrate-story', {
        body: { text: 'hello', language: 'en', character: 'narrator' },
      });
      expect(result).toEqual({ audioContent: 'base64audio' });
    });
  });
});
