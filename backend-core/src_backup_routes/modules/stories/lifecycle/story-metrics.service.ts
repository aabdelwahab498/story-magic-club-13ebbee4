import { Injectable } from '@nestjs/common';
import { GenerationMetrics } from './interfaces/lifecycle.interfaces.js';

@Injectable()
export class StoryMetricsService {
  private metrics: GenerationMetrics = {
    generationCount: 0,
    successCount: 0,
    failureCount: 0,
    averageGenerationDurationMs: 0,
    stageDurationsMs: {
      planner: 0,
      writer: 0,
      validator: 0,
    },
    providerLatencyMs: {},
  };

  private stageCounts: Record<string, number> = {
    planner: 0,
    writer: 0,
    validator: 0,
  };

  private providerCounts: Record<string, number> = {};

  recordGenerationStarted(): void {
    this.metrics.generationCount++;
  }

  recordGenerationSuccess(durationMs: number): void {
    const totalCurrentDuration =
      this.metrics.averageGenerationDurationMs * this.metrics.successCount;
    this.metrics.successCount++;
    this.metrics.averageGenerationDurationMs =
      (totalCurrentDuration + durationMs) / this.metrics.successCount;
  }

  recordGenerationFailure(): void {
    this.metrics.failureCount++;
  }

  recordStageDuration(stage: string, durationMs: number): void {
    if (!this.metrics.stageDurationsMs[stage]) {
      this.metrics.stageDurationsMs[stage] = 0;
      this.stageCounts[stage] = 0;
    }

    const currentTotal =
      this.metrics.stageDurationsMs[stage] * this.stageCounts[stage];
    this.stageCounts[stage]++;
    this.metrics.stageDurationsMs[stage] =
      (currentTotal + durationMs) / this.stageCounts[stage];
  }

  recordProviderLatency(provider: string, durationMs: number): void {
    if (!this.metrics.providerLatencyMs[provider]) {
      this.metrics.providerLatencyMs[provider] = 0;
      this.providerCounts[provider] = 0;
    }

    const currentTotal =
      this.metrics.providerLatencyMs[provider] * this.providerCounts[provider];
    this.providerCounts[provider]++;
    this.metrics.providerLatencyMs[provider] =
      (currentTotal + durationMs) / this.providerCounts[provider];
  }

  getMetrics(): GenerationMetrics {
    return { ...this.metrics };
  }
}
