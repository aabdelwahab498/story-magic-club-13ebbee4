import { Test, TestingModule } from '@nestjs/testing';
import { IllustrationService } from './illustration.service.js';
import { SceneExtractorService } from './scene-extractor.service.js';
import { IllustrationPromptBuilder } from './illustration-prompt.builder.js';
import { MockIllustrationProvider } from '../providers/mock-illustration.provider.js';
import { GoogleImageProvider } from '../providers/google-image.provider.js';
import { MediaConfigService } from '../media.config.js';
import { CharacterBibleService } from '../character/character.service.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { IllustrationProviderFactory } from '../providers/illustration-provider.factory.js';

describe('IllustrationService', () => {
  let service: IllustrationService;
  let supabaseService: SupabaseService;

  let module: TestingModule;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        IllustrationService,
        SceneExtractorService,
        IllustrationPromptBuilder,
        MockIllustrationProvider,
        {
          provide: GoogleImageProvider,
          useValue: { generateIllustration: jest.fn() },
        },
        {
          provide: MediaConfigService,
          useValue: { getImageProvider: jest.fn().mockReturnValue('mock') },
        },
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: CharacterBibleService,
          useValue: {
            getCharacters: jest.fn().mockResolvedValue([]),
            extractAndSeedCharacters: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: IllustrationProviderFactory,
          useFactory: (config: MediaConfigService, google: GoogleImageProvider, mock: MockIllustrationProvider) => {
            return {
              getProvider: () => {
                const providerName = config.getImageProvider();
                return providerName === 'google' ? google : mock;
              },
            };
          },
          inject: [MediaConfigService, GoogleImageProvider, MockIllustrationProvider],
        },
      ],
    }).compile();

    service = module.get<IllustrationService>(IllustrationService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate an illustration and update DB', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { pages: ['page 1 text'] },
      error: null,
    });

    const url = await service.generateIllustrations('story-1', 'media-1', {});

    expect(url).toContain('https://mock-storage.najmah.com/illustrations/');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });

  it('should generate an illustration with Google provider when configured', async () => {
    // Arrange
    const mockMediaConfig = module.get<MediaConfigService>(MediaConfigService);
    (mockMediaConfig.getImageProvider as jest.Mock).mockReturnValue('google');
    const mockGoogleProvider =
      module.get<GoogleImageProvider>(GoogleImageProvider);
    (mockGoogleProvider.generateIllustration as jest.Mock).mockResolvedValue({
      url: 'https://google.fake/img',
      provider: 'google',
      metadata: {},
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { pages: ['page 1 text'] },
      error: null,
    });

    // Act
    const url = await service.generateIllustrations('story-1', 'media-1', {});

    // Assert
    expect(url).toBe('https://google.fake/img');
    expect(mockGoogleProvider.generateIllustration).toHaveBeenCalled();
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'COMPLETED',
        provider: 'google',
      }),
    );
  });

  it('should handle provider errors and mark media as FAILED', async () => {
    const mockMediaConfig = module.get<MediaConfigService>(MediaConfigService);
    (mockMediaConfig.getImageProvider as jest.Mock).mockReturnValue('google');
    const mockGoogleProvider =
      module.get<GoogleImageProvider>(GoogleImageProvider);
    (mockGoogleProvider.generateIllustration as jest.Mock).mockRejectedValue(
      new Error('Provider failure'),
    );

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { pages: ['page 1 text'] },
      error: null,
    });

    const url = await service.generateIllustrations('story-1', 'media-1', {});

    expect(url).toBe('');
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
      }),
    );
  });
});
