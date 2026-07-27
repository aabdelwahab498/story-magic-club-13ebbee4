import { GeneratedStory } from '../../interfaces/generated-story.interface.js';
import { StoryContext } from '../../context/story-context.interface.js';
import { ValidationResult } from './validation-result.interface.js';

export const VALIDATION_RULE = 'VALIDATION_RULE';

export interface ValidationRule {
  validate(story: GeneratedStory, context: StoryContext): ValidationResult;
}
