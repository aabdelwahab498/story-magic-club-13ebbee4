import { Injectable } from '@nestjs/common';
import { ValidationRule } from './interfaces/validation-rule.interface.js';
import { StructureRule } from './rules/structure.rule.js';
import { AgeRule } from './rules/age.rule.js';
import { SelRule } from './rules/sel.rule.js';
import { SafetyRule } from './rules/safety.rule.js';
import { StoryGuardianService } from '../director/story-guardian.service.js';
import { ValidationResult } from './interfaces/validation-result.interface.js';
import { GeneratedStory } from '../interfaces/generated-story.interface.js';
import { StoryContext } from '../context/story-context.interface.js';

@Injectable()
export class StoryValidator {
  private readonly rules: ValidationRule[];

  constructor(
    private readonly structureRule: StructureRule,
    private readonly ageRule: AgeRule,
    private readonly selRule: SelRule,
    private readonly safetyRule: SafetyRule,
    private readonly storyGuardian: StoryGuardianService,
  ) {
    this.rules = [structureRule, ageRule, selRule, safetyRule];
  }

  /**
   * Validates a generated story against all registered rules and Story Guardian contract rules.
   * Never throws exceptions; returns a deterministic result object.
   */
  validateStory(
    story: GeneratedStory,
    context: StoryContext,
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    for (const rule of this.rules) {
      const ruleResult = rule.validate(story, context);
      if (!ruleResult.valid) {
        result.valid = false;
      }
      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
    }

    // Story Guardian Contract Validation
    const guardianResult = this.storyGuardian.validate(story, context as any);
    if (!guardianResult.valid) {
      result.valid = false;
    }
    result.errors.push(...guardianResult.errors);
    result.warnings.push(...guardianResult.warnings);

    return result;
  }
}
