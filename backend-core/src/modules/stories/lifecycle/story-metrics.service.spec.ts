import { Test, TestingModule } from '@nestjs/testing';
import { StoryMetricsService } from './story-metrics.service.js';

describe('StoryMetricsService', () => {
  let service: StoryMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoryMetricsService],
    }).compile();

    service = module.get<StoryMetricsService>(StoryMetricsService);
  });

  it('should initialize with empty metrics', () => {
    const metrics = service.getMetrics();
    expect(metrics.generationCount).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.failureCount).toBe(0);
    expect(metrics.averageGenerationDurationMs).toBe(0);
  });

  it('should record generation start and success', () => {
    service.recordGenerationStarted();
    service.recordGenerationSuccess(1000);
    service.recordGenerationSuccess(2000);

    const metrics = service.getMetrics();
    expect(metrics.generationCount).toBe(1);
    expect(metrics.successCount).toBe(2);
    expect(metrics.averageGenerationDurationMs).toBe(1500);
  });

  it('should record generation failure', () => {
    service.recordGenerationFailure();
    const metrics = service.getMetrics();
    expect(metrics.failureCount).toBe(1);
  });

  it('should calculate rolling average for stage durations', () => {
    service.recordStageDuration('planner', 100);
    service.recordStageDuration('planner', 300);

    const metrics = service.getMetrics();
    expect(metrics.stageDurationsMs['planner']).toBe(200);
  });

  it('should calculate rolling average for provider latency', () => {
    service.recordProviderLatency('gemini', 500);
    service.recordProviderLatency('gemini', 1500);

    const metrics = service.getMetrics();
    expect(metrics.providerLatencyMs['gemini']).toBe(1000);
  });
});
