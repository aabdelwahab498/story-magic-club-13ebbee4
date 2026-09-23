import { Test, TestingModule } from '@nestjs/testing';
import { IllustrationService } from './illustration/illustration.service.js';
import { SceneExtractorService } from './illustration/scene-extractor.service.js';
import { IllustrationPromptBuilder } from './illustration/illustration-prompt.builder.js';
import { MediaConfigService } from './media.config.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { CharacterBibleService } from './character/character.service.js';
import { IllustrationProviderFactory } from './providers/illustration-provider.factory.js';
import { GoogleImageProvider } from './providers/google-image.provider.js';
import {
  classifyProviderError,
  ErrorCategory,
  sanitizeSecrets,
} from '../../common/resilience/provider-error.classifier.js';
import { MediaService } from './media.service.js';
import { MediaGateway } from './gateway/media.gateway.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { ConfigService } from '@nestjs/config';

describe('Illustration Reliability & Resilience Regression Suite (A through K)', () => {
  let illustrationService: IllustrationService;
  let mediaService: MediaService;
  let googleImageProvider: GoogleImageProvider;
  let mockSupabase: any;
  let mockCreditsService: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
    };

    mockCreditsService = {
      getBalance: jest.fn().mockResolvedValue({ balance: 100 }),
      consumeCredits: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockSubscriptionsService = {
      canAccessFeature: jest.fn().mockResolvedValue({ allowed: true }),
      checkLimit: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
    };

    const mockUsageService = {
      trackUsage: jest.fn(),
    };

    const mockCharacterService = {
      getCharacters: jest.fn().mockResolvedValue([]),
      extractAndSeedCharacters: jest.fn().mockResolvedValue([]),
    };

    const mockProviderFactory = {
      getProvider: jest.fn(),
    };

    const mockMediaConfig = {
      getImageProvider: jest.fn().mockReturnValue('google'),
    };

    const mockSupabaseService = {
      getUserClient: () => mockSupabase,
      getAdminClient: () => mockSupabase,
    };

    const configService = new ConfigService({
      GOOGLE_API_KEY: 'test-google-key',
    });

    googleImageProvider = new GoogleImageProvider(configService);

    const mockProviderFactoryInstance = {
      getProvider: () => googleImageProvider,
    };

    illustrationService = new IllustrationService(
      new SceneExtractorService(),
      new IllustrationPromptBuilder(),
      mockMediaConfig as any,
      mockSupabaseService as any,
      mockCharacterService as any,
      mockProviderFactoryInstance as any,
    );

    mediaService = new MediaService(
      mockSupabaseService as any,
      {} as MediaGateway,
      illustrationService,
      mockCreditsService as any,
      mockUsageService as any,
      mockSubscriptionsService as any,
    );
  });

  // A) All pages succeed
  it('A) All pages succeed in illustration generation', async () => {
    const storyId = 'story-a';
    const mediaId = 'media-a';

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { pages: [{ pageNumber: 1, text: 'P1' }, { pageNumber: 2, text: 'P2' }] },
    });

    jest.spyOn(googleImageProvider, 'generateIllustration').mockResolvedValue({
      url: 'https://storage.najmah.com/media/page.png',
      provider: 'google',
      metadata: {},
    });

    const result = await illustrationService.generateIllustrations(storyId, mediaId);
    expect(result).toContain('https://');

    // Verify metadata update was called with final COMPLETED status
    const updateCalls = mockSupabase.update.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.status).toBe('COMPLETED');
  });

  // B) Page receives transient 429 then succeeds
  it('B) Page receives transient 429 then succeeds on provider retry', async () => {
    let calls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit 429 exceeded',
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'https://storage.najmah.com/media/page-429.png' }] } }] }),
      } as any;
    });

    const result = await googleImageProvider.generateIllustration({ text: 'prompt' }, { storyId: 's1', pageNumber: 1 });
    expect(result.url).toBe('https://storage.najmah.com/media/page-429.png');
    expect(calls).toBe(2);
  });

  // C) Transient 5xx then succeeds
  it('C) Page receives transient 5xx then succeeds on retry', async () => {
    let calls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable 503',
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'https://storage.najmah.com/media/page-503.png' }] } }] }),
      } as any;
    });

    const result = await googleImageProvider.generateIllustration({ text: 'prompt' });
    expect(result.url).toBe('https://storage.najmah.com/media/page-503.png');
    expect(calls).toBe(2);
  });

  // D) Timeout then succeeds
  it('D) Page receives timeout error then succeeds on retry', async () => {
    let calls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        const err: any = new Error('ETIMEDOUT: Connection timed out');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'https://storage.najmah.com/media/page-timeout.png' }] } }] }),
      } as any;
    });

    const result = await googleImageProvider.generateIllustration({ text: 'prompt' });
    expect(result.url).toBe('https://storage.najmah.com/media/page-timeout.png');
    expect(calls).toBe(2);
  });

  // E) Permanent provider failure is not endlessly retried
  it('E) Permanent provider failure (400) is not retried', async () => {
    let calls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      calls++;
      return {
        ok: false,
        status: 400,
        text: async () => 'Bad Request: Invalid prompt parameters',
      } as any;
    });

    await expect(
      googleImageProvider.generateIllustration({ text: 'invalid' }),
    ).rejects.toThrow('Google API error 400');
    expect(calls).toBe(1); // Only 1 attempt, no retry for 400!
  });

  // F) Successful page is not regenerated on retry
  it('F) Successful page is skipped and not regenerated on retry', async () => {
    const storyId = 'story-f';
    const mediaId = 'media-f';

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { pages: [{ pageNumber: 1, text: 'P1' }, { pageNumber: 2, text: 'P2' }] },
    });

    const mockGen = jest.spyOn(googleImageProvider, 'generateIllustration').mockResolvedValue({
      url: 'https://storage.najmah.com/media/new-page2.png',
      provider: 'google',
      metadata: {},
    });

    const metadata = {
      retryFailedOnly: true,
      pages: [
        { pageNumber: 1, imageUrl: 'https://storage.najmah.com/media/page1.png', status: 'COMPLETED' },
        { pageNumber: 2, imageUrl: null, status: 'FAILED' },
      ],
    };

    await illustrationService.generateIllustrations(storyId, mediaId, metadata);

    // Page 1 should NOT be sent to provider, only Page 2 should be generated!
    expect(mockGen).toHaveBeenCalledTimes(1);
    expect(mockGen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pageNumber: 2 }),
    );
  });

  // G) Successful page is not double-charged
  it('G) Retrying a job reuses existing record and does not double-charge credits', async () => {
    const storyId = 'story-g';
    const existingMedia = [
      {
        id: 'media-g',
        story_id: storyId,
        type: 'ILLUSTRATION',
        status: 'FAILED',
        metadata: { pages: [{ pageNumber: 1, status: 'FAILED' }] },
      },
    ];

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: storyId, user_id: 'user-1' } });
    mockSupabase.order.mockResolvedValueOnce({ data: existingMedia, error: null });

    const response = await mediaService.createIllustrationJob(storyId, 'user-1');
    expect(response.status).toBe('GENERATING');
    // Credits should NOT be consumed on retry of existing failed job!
    expect(mockCreditsService.consumeCredits).not.toHaveBeenCalled();
  });

  // H) Partial story retries only missing/failed pages
  it('H) Partial story retries only missing/failed pages', async () => {
    const storyId = 'story-h';
    const mediaId = 'media-h';

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: {
        pages: [
          { pageNumber: 1, text: 'P1' },
          { pageNumber: 2, text: 'P2' },
          { pageNumber: 3, text: 'P3' },
        ],
      },
    });

    const mockGen = jest.spyOn(googleImageProvider, 'generateIllustration').mockResolvedValue({
      url: 'https://storage.najmah.com/media/retry-p3.png',
      provider: 'google',
      metadata: {},
    });

    const existingMetadata = {
      retryFailedOnly: true,
      pages: [
        { pageNumber: 1, imageUrl: 'https://storage.najmah.com/media/p1.png', status: 'COMPLETED' },
        { pageNumber: 2, imageUrl: 'https://storage.najmah.com/media/p2.png', status: 'COMPLETED' },
        { pageNumber: 3, imageUrl: null, status: 'FAILED' },
      ],
    };

    await illustrationService.generateIllustrations(storyId, mediaId, existingMetadata);

    expect(mockGen).toHaveBeenCalledTimes(1);
    expect(mockGen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pageNumber: 3 }),
    );
  });

  // I) Concurrency/throttle prevents uncontrolled provider burst
  it('I) Throttle enforces minimum inter-request gap between calls', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'https://storage.najmah.com/media/page.png' }] } }] }),
    } as any);

    const start = Date.now();
    await googleImageProvider.generateIllustration({ text: 'p1' });
    await googleImageProvider.generateIllustration({ text: 'p2' });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(250);
  });

  // J) Exhausted retries persist FAILED state and remain manually retryable
  it('J) Exhausted retries set final status to FAILED while preserving completed pages', async () => {
    const storyId = 'story-j';
    const mediaId = 'media-j';

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: {
        pages: [
          { pageNumber: 1, text: 'P1' },
          { pageNumber: 2, text: 'P2' },
        ],
      },
    });

    jest.spyOn(googleImageProvider, 'generateIllustration')
      .mockResolvedValueOnce({ url: 'https://storage.najmah.com/media/p1.png', provider: 'google', metadata: {} })
      .mockRejectedValueOnce(new Error('Persistent provider failure'));

    await illustrationService.generateIllustrations(storyId, mediaId);

    const updateCalls = mockSupabase.update.mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect(finalUpdate.status).toBe('FAILED');
  });

  // K) Logs classify failure without exposing secrets
  it('K) Logs classify error category and sanitize secrets', () => {
    const errorWithSecret = new Error(
      'Google API error 429: Rate limit key=AIzaSecret123 Authorization: Bearer secret-token',
    );
    const classified = classifyProviderError(errorWithSecret);
    const sanitized = sanitizeSecrets(classified.message);

    expect(classified.category).toBe(ErrorCategory.RETRYABLE_TRANSIENT);
    expect(classified.isRetryable).toBe(true);
    expect(sanitized).not.toContain('AIzaSecret123');
    expect(sanitized).not.toContain('secret-token');
    expect(sanitized).toContain('key=[REDACTED]');
    expect(sanitized).toContain('Authorization: Bearer [REDACTED]');
  });
});
