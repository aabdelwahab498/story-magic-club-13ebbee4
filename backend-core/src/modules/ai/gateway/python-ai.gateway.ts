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
import { CircuitBreaker } from '../../../common/resilience/circuit-breaker.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../common/resilience/provider-error.classifier.js';

@Injectable()
export class PythonAIGateway implements IAIGateway {
  private readonly logger = new Logger(PythonAIGateway.name);
  private readonly pythonApiUrl: string;
  private readonly timeoutMs = 10000;
  private readonly circuitBreaker = new CircuitBreaker('python-ai', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(
    private readonly fallbackGateway: NestJSAIGateway,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
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
    context?: StoryContext,
  ): Promise<StoryPlan> {
    return this.circuitBreaker.execute(() =>
      this.callPythonPlanStory(
        childAge,
        language,
        theme,
        selGoal,
        readingLevel,
        context,
      ),
    );
  }

  private async callPythonPlanStory(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
    suppliedContext?: StoryContext,
  ): Promise<StoryPlan> {
    this.logger.log('Delegating Story Planning to Python AI Service');
    const context = suppliedContext || this.buildContext(
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
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text();
        const sanitizedErr = sanitizeSecrets(errText);
        throw new Error(
          `Python AI Service returned ${response.status}: ${sanitizedErr}`,
        );
      }

      const plan = (await response.json()) as StoryPlan;
      return plan;
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);
      this.logger.error(
        `Failed to plan story via Python AI [Category: ${classified.category}]: ${sanitizedMsg}`,
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
    return this.fallbackGateway.writeStory(context, blueprint);
  }

  validateStory(
    story: GeneratedStory,
    context: StoryContext,
  ): ValidationResult {
    return this.fallbackGateway.validateStory(story, context);
  }
}
