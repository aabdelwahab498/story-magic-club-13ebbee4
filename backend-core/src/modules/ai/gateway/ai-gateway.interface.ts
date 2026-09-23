import {
  GeneratedStory,
  StoryContext,
  StoryPlan,
  ValidationResult,
} from '@najmah/shared';

export const AI_GATEWAY = 'AI_GATEWAY';

export interface IAIGateway {
  /**
   * Build the initial AI context based on the user's inputs.
   */
  buildContext(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
  ): StoryContext;

  /**
   * Plan the story blueprint.
   */
  planStory(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
    context?: StoryContext,
  ): Promise<StoryPlan>;

  /**
   * Write the actual story based on the context and blueprint.
   */
  writeStory(
    context: StoryContext,
    blueprint: StoryPlan,
  ): Promise<GeneratedStory>;

  /**
   * Validate the generated story against business constraints.
   */
  validateStory(story: GeneratedStory, context: StoryContext): ValidationResult;
}
