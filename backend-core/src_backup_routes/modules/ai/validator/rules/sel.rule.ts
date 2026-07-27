import { Injectable } from '@nestjs/common';
import { ValidationRule } from '../interfaces/validation-rule.interface.js';
import { GeneratedStory } from '../../interfaces/generated-story.interface.js';
import { StoryContext } from '../../context/story-context.interface.js';
import { ValidationResult } from '../interfaces/validation-result.interface.js';

@Injectable()
export class SelRule implements ValidationRule {
  validate(story: GeneratedStory, context: StoryContext): ValidationResult {
    const errors: string[] = [];

    if (!story.metadata || !story.metadata.selGoal) {
      errors.push('SEL Goal is missing from story metadata.');
    } else if (
      story.metadata.selGoal.toLowerCase() !== context.selGoal.toLowerCase()
    ) {
      errors.push(
        `Story SEL Goal (${story.metadata.selGoal}) does not match Context SEL Goal (${context.selGoal}).`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
