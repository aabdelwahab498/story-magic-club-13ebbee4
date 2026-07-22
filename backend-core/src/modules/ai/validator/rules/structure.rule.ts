import { Injectable } from '@nestjs/common';
import { ValidationRule } from '../interfaces/validation-rule.interface.js';
import { GeneratedStory } from '../../interfaces/generated-story.interface.js';
import { StoryContext } from '../../context/story-context.interface.js';
import { ValidationResult } from '../interfaces/validation-result.interface.js';

@Injectable()
export class StructureRule implements ValidationRule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(story: GeneratedStory, _context: StoryContext): ValidationResult {
    const errors: string[] = [];

    if (!story.title || story.title.trim().length === 0) {
      errors.push('Story title is missing or empty.');
    }

    if (!story.pages || !Array.isArray(story.pages)) {
      errors.push('Story pages array is missing or invalid.');
    } else if (story.pages.length === 0) {
      errors.push('Story has zero pages.');
    } else {
      story.pages.forEach((page, index) => {
        if (!page.text || page.text.trim().length === 0) {
          errors.push(`Page ${index + 1} has missing or empty text.`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
