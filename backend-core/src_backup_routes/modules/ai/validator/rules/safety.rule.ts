import { Injectable } from '@nestjs/common';
import { ValidationRule } from '../interfaces/validation-rule.interface.js';
import { GeneratedStory } from '../../interfaces/generated-story.interface.js';
import { StoryContext } from '../../context/story-context.interface.js';
import { ValidationResult } from '../interfaces/validation-result.interface.js';

@Injectable()
export class SafetyRule implements ValidationRule {
  private readonly blocklist = [
    'kill',
    'die',
    'blood',
    'weapon',
    'gun',
    'knife',
    'murder',
    'idiot',
    'stupid',
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(story: GeneratedStory, _context: StoryContext): ValidationResult {
    const errors: string[] = [];
    const fullText = (
      story.title +
      ' ' +
      (story.pages?.map((p) => p.text).join(' ') || '')
    ).toLowerCase();

    for (const badWord of this.blocklist) {
      if (fullText.includes(badWord)) {
        errors.push(
          `Safety violation: Story contains inappropriate word '${badWord}'.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
