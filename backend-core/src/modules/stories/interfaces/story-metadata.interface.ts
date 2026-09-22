import { StoryStatus } from '../enums/story-status.enum.js';

export interface StoryMetadata {
  id: string;
  userId: string;
  childId: string;
  status: StoryStatus;
  language: string;
  readingLevel: string;
  theme: string;
  selGoal: string;
  pageCount: number;
  estimatedReadingTime: number;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
