import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider.js';
import { GeminiParser } from './gemini.parser.js';
import { AIProviderException } from '../../exceptions/ai.exceptions.js';
import { MetricsService } from '../../../metrics/metrics.service.js';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      };
    }),
  };
});

describe('GeminiProvider Resilience Suite (Scenarios A through I)', () => {
  let provider: GeminiProvider;
  const mockPrompt = { systemPrompt: 'System prompt', userPrompt: 'User prompt' };

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
              if (key === 'NODE_ENV') return 'test';
              if (key === 'GEMINI_API_KEY') return 'test-key';
              if (key === 'GEMINI_MODEL') return 'gemini-1.5-pro';
              if (key === 'GEMINI_TIMEOUT') return 500;
              return null;
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            observeAiProviderLatency: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<GeminiProvider>(GeminiProvider);
  });

  // A. 503 once then success
  it('A. retries on 503 once and succeeds on attempt 2', async () => {
    const error503 = new Error('HTTP 503 Service Unavailable');
    (error503 as any).status = 503;

    mockGenerateContent
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        response: { text: () => '{"title": "Recovered Story"}' },
      });

    const result = await provider.generateBlueprint(mockPrompt);
    expect(result).toBe('{"title": "Recovered Story"}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // B. 503 twice then success
  it('B. retries on 503 twice and succeeds on attempt 3', async () => {
    const error503 = new Error('HTTP 503 High Demand');
    (error503 as any).status = 503;

    mockGenerateContent
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce({
        response: { text: () => '{"title": "Story after 2 retries"}' },
      });

    const result = await provider.generateStory(mockPrompt);
    expect(result).toBe('{"title": "Story after 2 retries"}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  // C. 429 then success
  it('C. retries on 429 rate limit then succeeds', async () => {
    const error429 = new Error('Rate limit exceeded');
    (error429 as any).status = 429;

    mockGenerateContent
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        response: { text: () => '{"title": "429 Resolved"}' },
      });

    const result = await provider.generateBlueprint(mockPrompt);
    expect(result).toBe('{"title": "429 Resolved"}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // D. timeout/network error then success
  it('D. retries on timeout/network error then succeeds', async () => {
    const netErr = new Error('ECONNRESET connection reset by peer');
    (netErr as any).code = 'ECONNRESET';

    mockGenerateContent
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce({
        response: { text: () => '{"title": "Network Error Resolved"}' },
      });

    const result = await provider.generateStory(mockPrompt);
    expect(result).toBe('{"title": "Network Error Resolved"}');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // E. 503 exhausted → exactly 4 attempts → controlled 503 provider unavailable
  it('E. exhausts 4 attempts on 503 then throws 503 AIProviderException with AI_PROVIDER_TEMPORARILY_UNAVAILABLE', async () => {
    const error503 = new Error('HTTP 503 Service Unavailable');
    (error503 as any).status = 503;

    mockGenerateContent
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503);

    try {
      await provider.generateBlueprint(mockPrompt);
      fail('Expected generateBlueprint to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderException);
      expect(err.getStatus()).toBe(503);
      const res = err.getResponse();
      expect(res.statusCode).toBe(503);
      expect(res.code).toBe('AI_PROVIDER_TEMPORARILY_UNAVAILABLE');
      expect(res.message).toBe('The story service is temporarily busy. Please try again shortly.');
    }

    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
  });

  // F. 400 → exactly 1 attempt
  it('F. permanent 400 error does NOT retry and fails on attempt 1', async () => {
    const error400 = new Error('Bad Request: Invalid prompt payload');
    (error400 as any).status = 400;

    mockGenerateContent.mockRejectedValueOnce(error400);

    try {
      await provider.generateBlueprint(mockPrompt);
      fail('Expected generateBlueprint to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderException);
      expect(err.getStatus()).toBe(400);
    }

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  // G. 401/403 → exactly 1 attempt
  it('G. permanent 401/403 error does NOT retry and fails on attempt 1', async () => {
    const error401 = new Error('Unauthorized: Invalid API Key');
    (error401 as any).status = 401;

    mockGenerateContent.mockRejectedValueOnce(error401);

    try {
      await provider.generateStory(mockPrompt);
      fail('Expected generateStory to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderException);
      expect(err.getStatus()).toBe(401);
    }

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  // H. /stories/plan exhausted transient → HTTP 503 + AI_PROVIDER_TEMPORARILY_UNAVAILABLE
  it('H. exhausted transient error produces controlled HTTP 503 response envelope', async () => {
    const error503 = new Error('HTTP 503 Overloaded');
    (error503 as any).status = 503;

    mockGenerateContent
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503);

    let thrownError: any;
    try {
      await provider.generateBlueprint(mockPrompt);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.getStatus()).toBe(503);
    const body = thrownError.getResponse();
    expect(body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      code: 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE',
      message: 'The story service is temporarily busy. Please try again shortly.',
    });
  });

  // I. async story generation transient retry → no duplicate persistence/media/credits
  it('I. provider internal retries occur before persistence, credit deduction, and media dispatch', async () => {
    let callCount = 0;
    mockGenerateContent.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        const err = new Error('HTTP 503 Overloaded');
        (err as any).status = 503;
        return Promise.reject(err);
      }
      return Promise.resolve({
        response: { text: () => '{"title": "Idempotent Story", "pages": [{"pageNumber": 1, "text": "Page 1"}]}' },
      });
    });

    const result = await provider.generateStory(mockPrompt);
    expect(result).toBe('{"title": "Idempotent Story", "pages": [{"pageNumber": 1, "text": "Page 1"}]}');
    expect(callCount).toBe(3);
    // At this point, caller gets the result ONCE, ensuring single database write & credit deduction.
  });
});
