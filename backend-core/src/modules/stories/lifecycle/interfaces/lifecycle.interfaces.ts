import { StoryStatus } from '../../enums/story-status.enum.js';

export interface FailureMetadata {
  stage: string;
  code: string;
  message: string;
  retryable: boolean;
  timestamp: Date;
  provider?: string;
}

export interface StoryProgress {
  percentage: number;
  stage: string;
  updatedAt: Date;
}

export interface StoryEventPayload {
  requestId: string;
  userId: string;
  childId: string;
  status: StoryStatus;
  timestamp: Date;
  metadata?: any;
}

export interface GenerationMetrics {
  generationCount: number;
  successCount: number;
  failureCount: number;
  averageGenerationDurationMs: number;
  stageDurationsMs: Record<string, number>;
  providerLatencyMs: Record<string, number>;
}
