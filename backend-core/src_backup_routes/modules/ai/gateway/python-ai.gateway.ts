import { Injectable, Logger } from '@nestjs/common';
import { IAIGateway } from './ai-gateway.interface.js';
import { NestJSAIGateway } from './nestjs-ai.gateway.js';
import {
  GeneratedStory,
  StoryContext,
  StoryPlan,
  ValidationResult,
} from '@najmah/shared';
import { ConfigService } from '@nestjs/config';
import { RequestContext } from '../../../common/middleware/request-context.js';
import { MetricsService } from '../../metrics/metrics.service.js';

@Injectable()
export class PythonAIGateway implements IAIGateway {
  private readonly logger = new Logger(PythonAIGateway.name);
  private readonly pythonApiUrl: string;

  constructor(
    private readonly fallbackGateway: NestJSAIGateway,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    // Default to localhost:8000 for local dev if not specified
    this.pythonApiUrl =
      this.configService.get<string>('PYTHON_AI_URL') ||
      'http://localhost:8000';
  }

  buildContext(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
  ): StoryContext {
    // Not implemented in Python yet, fallback to NestJS
    return this.fallbackGateway.buildContext(
      childAge,
      language,
      theme,
      selGoal,
      readingLevel,
    );
  }

  async planStory(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
  ): Promise<StoryPlan> {
    this.logger.log('Delegating Story Planning to Python AI Service');
    const context = this.buildContext(
      childAge,
      language,
      theme,
      selGoal,
      readingLevel,
    );

    const startTime = Date.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (RequestContext.requestId) {
        headers['X-Request-ID'] = RequestContext.requestId;
      }
      if (RequestContext.traceId) {
        headers['X-Trace-ID'] = RequestContext.traceId;
      }

      const response = await fetch(`${this.pythonApiUrl}/ai/story/plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Python AI Service returned ${response.status}: ${errText}`,
        );
      }

      const plan = (await response.json()) as StoryPlan;
      return plan;
    } catch (error) {
      this.logger.error(
        `Failed to plan story via Python AI: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      this.metricsService.observeAiProviderLatency(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  async writeStory(
    context: StoryContext,
    blueprint: StoryPlan,
  ): Promise<GeneratedStory> {
    // Not implemented in Python yet, fallback to NestJS
    return this.fallbackGateway.writeStory(context, blueprint);
  }

  validateStory(
    story: GeneratedStory,
    context: StoryContext,
  ): ValidationResult {
    // Not implemented in Python yet, fallback to NestJS
    return this.fallbackGateway.validateStory(story, context);
  }
}
