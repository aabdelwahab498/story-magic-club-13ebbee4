import { IsEnum } from 'class-validator';
import { StoryStatus } from '../enums/story-status.enum.js';

export class UpdateStoryStatusDto {
  @IsEnum(StoryStatus)
  status!: StoryStatus;
}
