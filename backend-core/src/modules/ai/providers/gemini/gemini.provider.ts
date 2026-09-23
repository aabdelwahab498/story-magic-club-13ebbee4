import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import { LLMProvider } from '../../interfaces/llm-provider.interface.js';
import { GeneratedPrompt } from '../../prompts/generated-prompt.interface.js';
import { QualityScore } from '../../interfaces/story-types.js';
import { AIProviderException } from '../../exceptions/ai.exceptions.js';
import { GeminiParser } from './gemini.parser.js';
import type { Env } from '../../../../config/env.config.js';
import { MetricsService } from '../../../metrics/metrics.service.js';
import { CircuitBreaker } from '../../../../common/resilience/circuit-breaker.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../../common/resilience/provider-error.classifier.js';

@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly ai: GoogleGenerativeAI;
  private readonly model: GenerativeModel;
  private readonly timeoutMs: number;
  private readonly circuitBreaker = new CircuitBreaker('llm', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly parser: GeminiParser,
    private readonly metricsService: MetricsService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (nodeEnv === 'production' && (!apiKey || apiKey === 'mock-key')) {
      throw new Error(
        'GeminiProvider error: GEMINI_API_KEY is missing or invalid in production.',
      );
    }

    const effectiveApiKey = apiKey || 'mock-key';
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.timeoutMs = this.configService.get<number>('GEMINI_TIMEOUT') || 20000;

    this.ai = new GoogleGenerativeAI(effectiveApiKey);
    this.model = this.ai.getGenerativeModel({ model: modelName });
  }

  async generateBlueprint(prompt: GeneratedPrompt): Promise<string> {
    return this.executeWithResilience(prompt);
  }

  async generateStory(prompt: GeneratedPrompt): Promise<string> {
    return this.executeWithResilience(prompt);
  }

  /**
   * Evaluates quality of a story.
   * Note: Canonical story validation and quality checks are handled by StoryValidator & StoryGuardianService.
   */
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async evaluateQuality(_story: string): Promise<QualityScore> {
    return {
      score: 20,
      passed: true,
      feedback:
        'Story quality validated deterministically by StoryValidator & StoryGuardianService.',
    };
  }

  private async executeWithResilience(
    prompt: GeneratedPrompt,
  ): Promise<string> {
    return this.circuitBreaker.execute(() =>
      this.callGeminiWithAttempts(prompt, 4),
    );
  }

  private async callGeminiWithAttempts(
    prompt: GeneratedPrompt,
    attempts = 4,
  ): Promise<string> {
    const startTime = Date.now();
    let lastError: any;

    try {
      for (let i = 1; i <= attempts; i++) {
        if (i > 1) {
          const retryIndex = i - 1;
          const isTest = this.configService.get<string>('NODE_ENV') === 'test';
          let baseDelay = isTest ? 10 : 1000 * Math.pow(2, retryIndex - 1); // 1000ms, 2000ms, 4000ms

          const retryAfterSec = this.extractRetryAfter(lastError);
          if (retryAfterSec && retryAfterSec > 0) {
            const retryAfterMs = Math.min(retryAfterSec * (isTest ? 10 : 1000), 10000);
            baseDelay = Math.max(baseDelay, retryAfterMs);
          }

          const jitter = isTest ? 0 : Math.floor(Math.random() * 200);
          const totalDelay = baseDelay + jitter;

          this.logger.log(
            `Backoff for Gemini API retry ${i}/${attempts}: sleeping ${totalDelay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
        }

        try {
          const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`;

          const requestPromise = this.model.generateContent(fullPrompt);

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('Gemini API timeout')),
              this.timeoutMs,
            );
          });

          const result = (await Promise.race([
            requestPromise,
            timeoutPromise,
          ])) as GenerateContentResult;
          const responseText = result.response.text();

          return this.parser.extractJsonString(responseText);
        } catch (error: any) {
          lastError = error;
          const classified = classifyProviderError(error);
          const sanitizedMsg = sanitizeSecrets(classified.message);

          this.logger.warn(
            `Gemini API attempt ${i}/${attempts} failed [Category: ${classified.category}]: ${sanitizedMsg}`,
          );

          if (!classified.isRetryable) {
            this.logger.error(
              `Non-retryable permanent Gemini failure on attempt ${i}/${attempts}: ${sanitizedMsg}`,
            );
            const status = classified.statusCode || 400;
            throw new AIProviderException(
              `Gemini API call failed (${classified.category}): ${sanitizedMsg}`,
              error,
              status,
            );
          }
        }
      }

      const finalClassified = classifyProviderError(lastError);
      const sanitizedFinalMsg = sanitizeSecrets(finalClassified.message);

      this.logger.error(
        `Gemini API exhausted all ${attempts} retry attempts (${finalClassified.category}): ${sanitizedFinalMsg}`,
      );

      throw new AIProviderException(
        `Gemini API call exhausted retries (${finalClassified.category}): ${sanitizedFinalMsg}`,
        lastError,
        503,
      );
    } finally {
      this.metricsService.observeAiProviderLatency(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  private extractRetryAfter(error: any): number | null {
    if (!error) return null;
    const headers = error?.response?.headers || error?.headers;
    if (!headers) return null;

    const retryAfter =
      headers['retry-after'] ||
      headers['Retry-After'] ||
      (typeof headers.get === 'function' ? headers.get('retry-after') : null);

    if (retryAfter) {
      const parsed = parseInt(String(retryAfter), 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
  }
}
