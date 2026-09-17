import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LLMProvider } from '../../interfaces/llm-provider.interface.js';
import { GeneratedPrompt } from '../../prompts/generated-prompt.interface.js';
import { QualityScore } from '../../interfaces/story-types.js';
import {
  AIProviderException,
  AIProviderUnavailableException,
} from '../../exceptions/ai.exceptions.js';
import { GeminiParser } from './gemini.parser.js';
import type { Env } from '../../../../config/env.config.js';
import { MetricsService } from '../../../metrics/metrics.service.js';
import {
  classifyProviderError,
  type ClassifiedProviderError,
} from './gemini.error-classifier.js';

/** Bounded retry policy for transient provider failures. */
const MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10_000;

@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly ai: GoogleGenerativeAI;
  private readonly model: GenerativeModel;
  private readonly timeoutMs: number;
  private readonly baseDelayMs: number;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly parser: GeminiParser,
    private readonly metricsService: MetricsService,
  ) {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') || 'mock-key';
    const modelName = this.configService.get<string>('GEMINI_MODEL');
    this.timeoutMs = this.configService.get<number>('GEMINI_TIMEOUT');
    this.baseDelayMs =
      (this.configService.get<number>(
        'GEMINI_RETRY_BASE_DELAY_MS' as keyof Env & string,
      ) as number | null) ?? DEFAULT_BASE_DELAY_MS;

    this.ai = new GoogleGenerativeAI(apiKey);
    this.model = this.ai.getGenerativeModel({ model: modelName });
  }

  async generateBlueprint(prompt: GeneratedPrompt): Promise<string> {
    return this.callGeminiWithAttempts(prompt, 'blueprint');
  }

  async generateStory(prompt: GeneratedPrompt): Promise<string> {
    return this.callGeminiWithAttempts(prompt, 'story');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async evaluateQuality(_story: string): Promise<QualityScore> {
    throw new Error('evaluateQuality is not implemented yet in Sprint 5.5');
  }

  /**
   * Executes one logical provider operation with bounded exponential backoff
   * + jitter for RETRYABLE_TRANSIENT failures. Permanent failures (bad
   * request, credentials, unsupported model) fail on the first attempt.
   *
   * Callers (and therefore any circuit breaker wrapping them) observe a
   * single logical outcome — never one failure per internal attempt.
   */
  private async callGeminiWithAttempts(
    prompt: GeneratedPrompt,
    operation: string,
    maxAttempts = MAX_ATTEMPTS,
  ): Promise<string> {
    const startTime = Date.now();
    let lastError: unknown;
    let lastClassification: ClassifiedProviderError | undefined;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`;

          const requestPromise = this.model.generateContent(fullPrompt);
          let timer: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Gemini API timeout')),
              this.timeoutMs,
            );
          });

          let result: any;
          try {
            result = await Promise.race([requestPromise, timeoutPromise]);
          } finally {
            if (timer) clearTimeout(timer);
          }
          const responseText = result.response.text() as string;

          return this.parser.extractJsonString(responseText);
        } catch (error) {
          lastError = error;
          const classification = classifyProviderError(error);
          lastClassification = classification;

          const isLastAttempt = attempt === maxAttempts;
          const backoffMs =
            classification.retryable && !isLastAttempt
              ? this.computeBackoffMs(attempt, classification.retryAfterMs)
              : 0;

          // Structured, secret-free operational metadata only.
          this.logger.warn(
            JSON.stringify({
              event: 'ai_provider_attempt_failed',
              provider: 'gemini',
              operation,
              attempt,
              maxAttempts,
              errorCategory: classification.category,
              reason: classification.reason,
              httpStatus: classification.httpStatus,
              retryable: classification.retryable,
              backoffMs,
            }),
          );

          if (!classification.retryable) {
            throw new AIProviderException(
              `Gemini rejected the request (${classification.reason})`,
              error,
            );
          }

          if (isLastAttempt) break;
          await this.delay(backoffMs);
        }
      }

      throw new AIProviderUnavailableException(
        `Gemini unavailable after ${maxAttempts} attempts (${lastClassification?.reason ?? 'unknown'})`,
        {
          provider: 'gemini',
          operation,
          attempts: maxAttempts,
          httpStatus: lastClassification?.httpStatus,
          errorCategory:
            lastClassification?.category ?? 'RETRYABLE_TRANSIENT',
          retryAfterMs: lastClassification?.retryAfterMs,
        },
        lastError,
      );
    } finally {
      this.metricsService.observeAiProviderLatency(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  /** ~1s, ~2s, ~4s … with full jitter, honoring a capped provider Retry-After. */
  private computeBackoffMs(attempt: number, retryAfterMs?: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt - 1);
    const advised =
      retryAfterMs !== undefined && retryAfterMs > 0
        ? Math.min(retryAfterMs, MAX_DELAY_MS)
        : 0;
    const target = Math.min(Math.max(exponential, advised), MAX_DELAY_MS);
    const jitter = Math.random() * (target * 0.25);
    return Math.round(target + jitter);
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
