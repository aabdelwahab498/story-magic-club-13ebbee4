import { Injectable } from '@nestjs/common';
import { ValidationRule } from '../interfaces/validation-rule.interface.js';
import { GeneratedStory } from '../../interfaces/generated-story.interface.js';
import { StoryContext } from '../../context/story-context.interface.js';
import { ValidationResult } from '../interfaces/validation-result.interface.js';

@Injectable()
export class AgeRule implements ValidationRule {
  validate(story: GeneratedStory, context: StoryContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic age constraint heuristic: length of text per page
    const maxCharsPerPage = context.targetAge < 5 ? 200 : 500;

    if (story.pages && Array.isArray(story.pages)) {
      story.pages.forEach((page, index) => {
        if (page.text && page.text.length > maxCharsPerPage) {
          warnings.push(
            `Page ${index + 1} is exceptionally long (${page.text.length} chars) for age ${context.targetAge}.`,
          );
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
