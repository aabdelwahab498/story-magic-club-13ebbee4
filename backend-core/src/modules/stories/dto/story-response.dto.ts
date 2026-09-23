import { StoryMetadata } from '../interfaces/story-metadata.interface.js';
import { StoryPage } from '../../ai/interfaces/generated-story.interface.js';
import { StoryStatus } from '../enums/story-status.enum.js';

export class StoryResponseDto {
  id!: string;
  userId!: string;
  childId?: string;
  status!: StoryStatus;
  metadata!: Omit<
    StoryMetadata,
    'id' | 'userId' | 'childId' | 'status' | 'createdAt' | 'updatedAt'
  >;
  title?: string;
  pages?: StoryPage[];
  createdAt!: Date;
  updatedAt!: Date;

  // Enriched SEL Frontend Compatibility Fields
  story_id?: string;
  sel_outcome?: { skill: string; emotion: string; statement: string };
  character_visual_hash?: string;
  age_band?: string;
  quality?: Record<string, any>;
  safety?: Record<string, any>;
  length?: Record<string, any>;
  passed?: boolean;
  regeneration_count?: number;
  blueprint?: Record<string, any>;
}
