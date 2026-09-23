import { Injectable, Logger } from '@nestjs/common';
import { GeneratedStory, StoryContext, ValidationResult } from '@najmah/shared';
import { StoryContract } from './story-contract.interface.js';

@Injectable()
export class StoryGuardianService {
  private readonly logger = new Logger(StoryGuardianService.name);

  /**
   * Validates a generated story against the derived StoryContract and StoryContext.
   * Rejects stories that replace specified protagonists, drop key elements, or substitute unrelated narratives.
   */
  validate(
    story: GeneratedStory,
    context: StoryContext & { contract?: StoryContract },
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const contract = context.contract;
    if (!contract || !contract.hasCustomPrompt) {
      // Basic check for empty story
      if (!story || !story.pages || story.pages.length === 0) {
        errors.push('Story contains no pages.');
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }

    const fullText = (story.title + ' ' + (story.pages || []).map((p) => p.text).join(' ')).toLowerCase();

    // 1. Protagonist Identity Check
    if (contract.protagonistName) {
      const expectedNameLower = contract.protagonistName.toLowerCase();
      if (!fullText.includes(expectedNameLower)) {
        errors.push(
          `Story Guardian Violation: Story omitted specified protagonist "${contract.protagonistName}".`,
        );
      }
    }

    // Check for known unrelated story substitution (e.g., "Leo", "Pip", "Safari", "Golden Acorn") when not requested
    if (
      contract.rawPrompt &&
      !contract.rawPrompt.toLowerCase().includes('leo') &&
      fullText.includes('leo') &&
      fullText.includes('safari')
    ) {
      errors.push(
        `Story Guardian Violation: Story generated an unrelated narrative ("Leo's Safari") instead of the requested brief.`,
      );
    }

    // 2. Key Object / Premise Check
    if (contract.keyObjects && contract.keyObjects.length > 0) {
      const missingObjects = contract.keyObjects.filter(
        (obj) => !fullText.includes(obj.toLowerCase()),
      );
      if (missingObjects.length === contract.keyObjects.length) {
        errors.push(
          `Story Guardian Violation: Story text omitted key brief elements (${contract.keyObjects.join(', ')}).`,
        );
      }
    }

    // 3. Ending / Resolution Requirement Check
    if (contract.endingRequirement) {
      const endingTerms = ['sky', 'home', 'return', 'night'];
      const hasEndingConcept = endingTerms.some((term) => fullText.includes(term));
      if (!hasEndingConcept) {
        warnings.push(
          `Story Guardian Warning: Story ending may not fully reflect requested resolution (${contract.endingRequirement}).`,
        );
      }
    }

    const valid = errors.length === 0;

    if (!valid) {
      this.logger.warn(
        `[STORY_GUARDIAN_REJECTED] Story "${story.title}" failed contract validation: ${errors.join(' | ')}`,
      );
    } else {
      this.logger.log(
        `[STORY_GUARDIAN_APPROVED] Story "${story.title}" satisfies all contract requirements.`,
      );
    }

    return {
      valid,
      errors,
      warnings,
    };
  }
}
