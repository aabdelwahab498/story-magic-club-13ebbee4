import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { LLMProvider } from '../../interfaces/llm-provider.interface.js';
import { GeneratedPrompt } from '../../prompts/generated-prompt.interface.js';
import { QualityScore } from '../../interfaces/story-types.js';
import { AIProviderException } from '../../exceptions/ai.exceptions.js';
import { GeminiParser } from './gemini.parser.js';
import type { Env } from '../../../../config/env.config.js';
import { MetricsService } from '../../../metrics/metrics.service.js';

@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly ai: GoogleGenerativeAI;
  private readonly model: GenerativeModel;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly parser: GeminiParser,
    private readonly metricsService: MetricsService,
  ) {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') || 'mock-key';
    const modelName = this.configService.get<string>('GEMINI_MODEL');
    this.timeoutMs = this.configService.get<number>('GEMINI_TIMEOUT');

    this.ai = new GoogleGenerativeAI(apiKey);
    this.model = this.ai.getGenerativeModel({ model: modelName });
  }

  async generateBlueprint(prompt: GeneratedPrompt): Promise<string> {
    return this.callGeminiWithRetry(prompt);
  }

  async generateStory(prompt: GeneratedPrompt): Promise<string> {
    return this.callGeminiWithRetry(prompt);
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async evaluateQuality(_story: string): Promise<QualityScore> {
    throw new Error('evaluateQuality is not implemented yet in Sprint 5.5');
  }

  private async callGeminiWithRetry(
    prompt: GeneratedPrompt,
    attempts = 2,
  ): Promise<string> {
    let lastError: unknown;
    const startTime = Date.now();

    try {
      for (let i = 1; i <= attempts; i++) {
        try {
          const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`;

          // Use Promise.race to enforce timeout
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
          ])) as any;
          const responseText = result.response.text() as string;

          // Extract JSON string using parser
          return this.parser.extractJsonString(responseText);
        } catch (error) {
          lastError = error;
          this.logger.warn(
            `Gemini API attempt ${i} failed: ${(error as Error).message}`,
          );

          // Re-throw immediately if we have exhausted attempts
          if (i === attempts) {
            break;
          }
        }
      }

      throw new AIProviderException(
        `Gemini API failed after ${attempts} attempts. Last error: ${(lastError as Error).message}`,
      );
    } finally {
      this.metricsService.observeAiProviderLatency(
        (Date.now() - startTime) / 1000,
      );
    }
  }
}
