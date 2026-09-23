import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider.js';
import { GeminiParser } from './gemini.parser.js';
import {
  AIProviderException,
  AIParseException,
} from '../../exceptions/ai.exceptions.js';

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

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let parser: GeminiParser;

  beforeEach(async () => {
    mockGenerateContent.mockClear();

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
              if (key === 'GEMINI_MODEL') return 'gemini-2.5-flash';
              if (key === 'GEMINI_TIMEOUT') return 1000;
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
    parser = module.get<GeminiParser>(GeminiParser);
  });

  describe('Parser', () => {
    it('should strip markdown json wrapper', () => {
      const raw = '```json\n{"data": true}\n```';
      expect(parser.extractJsonString(raw)).toBe('{"data": true}');
    });

    it('should strip plain markdown wrapper', () => {
      const raw = '```\n{"data": true}\n```';
      expect(parser.extractJsonString(raw)).toBe('{"data": true}');
    });

    it('should throw AIParseException if response is empty after stripping', () => {
      const raw = '```json\n\n```';
      expect(() => parser.extractJsonString(raw)).toThrow(AIParseException);
    });
  });

  describe('Provider', () => {
    const mockPrompt = { systemPrompt: 'System', userPrompt: 'User' };

    it('should return successfully parsed json string', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => '```json\n{"success": true}\n```' },
      });

      const result = await provider.generateBlueprint(mockPrompt);
      expect(result).toBe('{"success": true}');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failure and succeed', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          response: { text: () => '{"retry": "success"}' },
        });

      const result = await provider.generateStory(mockPrompt);
      expect(result).toBe('{"retry": "success"}');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw AIProviderException if all attempts fail', async () => {
      const err = new Error('HTTP 503 Overloaded');
      (err as any).status = 503;
      mockGenerateContent
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err);

      await expect(provider.generateBlueprint(mockPrompt)).rejects.toThrow(
        AIProviderException,
      );
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    });

    it('should throw AIProviderException on timeout', async () => {
      mockGenerateContent.mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 2000));
      });

      await expect(provider.generateStory(mockPrompt)).rejects.toThrow(
        AIProviderException,
      );
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    });
  });
});
