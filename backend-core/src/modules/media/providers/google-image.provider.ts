import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMediaProvider } from './media-provider.interface.js';
import { CircuitBreaker } from '../../../common/resilience/circuit-breaker.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../common/resilience/provider-error.classifier.js';

@Injectable()
export class GoogleImageProvider implements IMediaProvider {
  private readonly logger = new Logger(GoogleImageProvider.name);
  private readonly apiKey: string;
  private readonly timeoutMs = 25000;
  private readonly circuitBreaker = new CircuitBreaker('illustration', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const key = this.configService.get<string>('GOOGLE_API_KEY');

    if (!key) {
      if (nodeEnv === 'production') {
        throw new Error(
          'GoogleImageProvider initialization error: GOOGLE_API_KEY is missing in production',
        );
      }
      this.apiKey = 'mock-google-key';
    } else {
      this.apiKey = key;
    }
  }

  get name(): string {
    return 'google';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    storyId: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return `https://storage.najmah.com/media/google-${Date.now()}.png`;
  }

  async generateIllustration(
    prompt: any,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }> {
    return this.circuitBreaker.execute(() =>
      this.executeWithRetryAndThrottle(prompt, metadata),
    );
  }

  private lastCallTime = 0;
  private readonly minInterRequestGapMs = 300;

  private async executeWithRetryAndThrottle(
    prompt: any,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }> {
    const maxAttempts = 3;
    let attempt = 0;
    const pageNumber = metadata?.pageNumber ?? 'N/A';
    const storyId = metadata?.storyId ?? 'N/A';

    while (attempt < maxAttempts) {
      attempt++;

      // Throttle concurrency/bursts
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      if (elapsed < this.minInterRequestGapMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minInterRequestGapMs - elapsed),
        );
      }
      this.lastCallTime = Date.now();

      try {
        const result = await this.callGoogleImageApi(prompt, metadata);
        this.logger.log(
          `[ILLUSTRATION_PROVIDER_SUCCESS] Story: ${storyId}, Page: ${pageNumber}, Attempt: ${attempt}/${maxAttempts}, Provider: ${this.name}`,
        );
        return result;
      } catch (error: any) {
        const classified = classifyProviderError(error);
        const sanitizedMsg = sanitizeSecrets(classified.message);
        const isExhausted = attempt >= maxAttempts;

        if (!classified.isRetryable || isExhausted) {
          this.logger.error(
            `[ILLUSTRATION_PROVIDER_FAILED] Story: ${storyId}, Page: ${pageNumber}, Attempt: ${attempt}/${maxAttempts}, Provider: ${this.name}, Category: ${classified.category}, Status: ${classified.statusCode || 'N/A'}, Retryable: ${classified.isRetryable}, Exhausted: ${isExhausted}: ${sanitizedMsg}`,
          );
          throw error;
        }

        const backoffMs = Math.floor(
          1000 * Math.pow(2, attempt - 1) + Math.random() * 500,
        );
        this.logger.warn(
          `[ILLUSTRATION_PROVIDER_RETRY] Story: ${storyId}, Page: ${pageNumber}, Attempt: ${attempt}/${maxAttempts}, Provider: ${this.name}, Category: ${classified.category}, Status: ${classified.statusCode || 'N/A'}, Retryable: true. Retrying in ${backoffMs}ms: ${sanitizedMsg}`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error('Retries exhausted');
  }

  private async callGoogleImageApi(
    prompt: any,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }> {
    const rawEndpoint = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-pro-vision:generateContent?key=${this.apiKey}`;
    const sanitizedEndpoint = sanitizeSecrets(rawEndpoint);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: this.buildPromptText(prompt) }],
        },
      ],
    };

    try {
      const response = await fetch(rawEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text();
        const sanitizedErr = sanitizeSecrets(errText);
        const err: any = new Error(
          `Google API error ${response.status}: ${sanitizedErr}`,
        );
        err.status = response.status;
        err.statusCode = response.status;
        throw err;
      }

      const data = await response.json();
      const url = this.extractImageUrl(data);

      return {
        url,
        provider: this.name,
        metadata: { ...metadata, prompt },
      };
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);
      this.logger.error(
        `GoogleImageProvider request failed [Category: ${classified.category}, Status: ${classified.statusCode || 'N/A'}]: ${sanitizedMsg}`,
      );
      throw error;
    }
  }

  private buildPromptText(prompt: any): string {
    if (typeof prompt === 'string') return prompt;
    if (prompt && typeof prompt.text === 'string') return prompt.text;
    return JSON.stringify(prompt);
  }

  private extractImageUrl(data: any): string {
    try {
      const candidate = data?.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const possibleUrl = part?.text?.trim();
      if (possibleUrl && possibleUrl.startsWith('http')) return possibleUrl;
    } catch {
      // fall through to fallback
    }
    return `https://placeholder.najmah.com/google/${Date.now()}.png`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async status(
    trackingId: string,
  ): Promise<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'> {
    return 'COMPLETED';
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cancel(trackingId: string): Promise<boolean> {
    return true;
  }
}
