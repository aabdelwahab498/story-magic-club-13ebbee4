import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider.js';
import { GeminiParser } from './gemini.parser.js';
import {
  AIProviderException,
  AIProviderUnavailableException,
} from '../../exceptions/ai.exceptions.js';
import { MetricsService } from '../../../metrics/metrics.service.js';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

const ok = (json: string) => ({ response: { text: () => json } });

const providerError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

describe('GeminiProvider — transient failure resilience', () => {
  let provider: GeminiProvider;

  beforeEach(async () => {
    mockGenerateContent.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        GeminiParser,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'test-key';
              if (key === 'GEMINI_MODEL') return 'gemini-1.5-flash';
              if (key === 'GEMINI_TIMEOUT') return 1000;
              // Keep backoff deterministic and instant in tests.
              if (key === 'GEMINI_RETRY_BASE_DELAY_MS') return 0;
              return null;
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: { observeAiProviderLatency: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get(GeminiProvider);
  });

  const prompt = { systemPrompt: 'System', userPrompt: 'User' };

  // A. one 503 then success
  it('recovers automatically after a single 503', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(
        providerError(503, 'This model is currently experiencing high demand.'),
      )
      .mockResolvedValueOnce(ok('{"ok":1}'));

    await expect(provider.generateBlueprint(prompt)).resolves.toBe('{"ok":1}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // B. two 503s then success
  it('recovers automatically after two 503s', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(providerError(503, 'Service Unavailable'))
      .mockRejectedValueOnce(providerError(503, 'Service Unavailable'))
      .mockResolvedValueOnce(ok('{"ok":2}'));

    await expect(provider.generateStory(prompt)).resolves.toBe('{"ok":2}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  // C. 429 then success (honors capped Retry-After)
  it('recovers automatically after a 429 with Retry-After', async () => {
    const err = providerError(429, 'Too Many Requests');
    (err as any).response = { headers: { 'retry-after': '0' } };
    mockGenerateContent
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(ok('{"ok":3}'));

    await expect(provider.generateBlueprint(prompt)).resolves.toBe('{"ok":3}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // D. network/timeout transient then success
  it('recovers automatically after a network transient', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(
        Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
      )
      .mockResolvedValueOnce(ok('{"ok":4}'));

    await expect(provider.generateStory(prompt)).resolves.toBe('{"ok":4}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // E. exhausted transient → bounded attempts + controlled exception
  it('stops after exactly 4 attempts and throws a retryable unavailable error', async () => {
    mockGenerateContent.mockRejectedValue(
      providerError(503, 'This model is currently experiencing high demand.'),
    );

    await expect(provider.generateBlueprint(prompt)).rejects.toBeInstanceOf(
      AIProviderUnavailableException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
  });

  it('exposes safe machine-readable metadata on exhaustion', async () => {
    mockGenerateContent.mockRejectedValue(providerError(503, 'overloaded'));

    const error = await provider
      .generateStory(prompt)
      .catch((e: unknown) => e as AIProviderUnavailableException);

    expect(error).toBeInstanceOf(AIProviderUnavailableException);
    expect(error.code).toBe('AI_PROVIDER_TEMPORARILY_UNAVAILABLE');
    expect(error.retryable).toBe(true);
    expect(error.meta).toMatchObject({
      provider: 'gemini',
      operation: 'story',
      attempts: 4,
      httpStatus: 503,
      errorCategory: 'RETRYABLE_TRANSIENT',
    });
    expect(error.message).not.toContain('System');
  });

  // F. permanent 400 → single attempt
  it('fails immediately on a permanent 400', async () => {
    mockGenerateContent.mockRejectedValue(
      providerError(400, 'Invalid argument: request malformed'),
    );

    await expect(provider.generateBlueprint(prompt)).rejects.toBeInstanceOf(
      AIProviderException,
    );
    await expect(provider.generateBlueprint(prompt)).rejects.not.toBeInstanceOf(
      AIProviderUnavailableException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(2); // 1 per invocation
  });

  // G. credentials/authorization → single attempt
  it.each([
    [401, 'API key not valid. Please pass a valid API key.'],
    [403, 'Permission denied'],
  ])('fails immediately on %s', async (status, message) => {
    mockGenerateContent.mockRejectedValue(providerError(status, message));

    await expect(provider.generateStory(prompt)).rejects.toBeInstanceOf(
      AIProviderException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('fails immediately on an unsupported model', async () => {
    mockGenerateContent.mockRejectedValue(
      new Error('models/foo is not found for API version v1'),
    );

    await expect(provider.generateBlueprint(prompt)).rejects.toBeInstanceOf(
      AIProviderException,
    );
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
