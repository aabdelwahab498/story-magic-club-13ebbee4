import { BadRequestException } from '@nestjs/common';
import { StoryStatus } from '../../enums/story-status.enum.js';

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(currentStatus: StoryStatus, targetStatus: StoryStatus) {
    super(
      `Invalid story status transition from ${currentStatus} to ${targetStatus}`,
    );
    this.name = 'InvalidStatusTransitionException';
  }
}
