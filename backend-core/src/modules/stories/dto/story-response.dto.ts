import { StoryMetadata } from '../interfaces/story-metadata.interface.js';
import { StoryPage } from '../../ai/interfaces/generated-story.interface.js';
import { StoryStatus } from '../enums/story-status.enum.js';

export class StoryResponseDto {
  id!: string;
  userId!: string;
  childId!: string;
  status!: StoryStatus;
  metadata!: Omit<
    StoryMetadata,
    'id' | 'userId' | 'childId' | 'status' | 'createdAt' | 'updatedAt'
  >;
  title?: string;
  pages?: StoryPage[];
  createdAt!: Date;
  updatedAt!: Date;
}
