import { Injectable } from '@nestjs/common';
import { StoryContext } from './story-context.interface.js';
import { StoryMetadata } from '../../stories/interfaces/story-metadata.interface.js';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { ChildrenAIContextService } from '../../children/ai-context/children-ai-context.service.js';

@Injectable()
export class StoryContextBuilder {
  constructor(
    private readonly childrenAiContextService: ChildrenAIContextService,
  ) {}

  /**
   * Builds the AI story context from a user request and child profile.
   */
  async buildFromRequest(
    user: UserContext,
    request: StoryMetadata,
  ): Promise<StoryContext> {
    let age = request.age!;
    let childName = request.childName;

    if (request.childId) {
      try {
        const childContext = await this.childrenAiContextService.buildContext(
          user,
          request.childId,
        );
        if (childContext.age) age = childContext.age;
      } catch {
        // Fallback to request age if child context fetch fails
      }
    }

    const rawCustomPrompt =
      request.customPrompt ||
      (typeof request.preferences?.customPrompt === 'string'
        ? request.preferences.customPrompt
        : undefined);

    const customPrompt =
      typeof rawCustomPrompt === 'string' && rawCustomPrompt.trim().length > 0
        ? rawCustomPrompt.trim()
        : undefined;

    return this.build(
      age,
      request.language,
      request.theme,
      request.selGoal,
      request.readingLevel,
      {
        childName,
        emotionalFocus: request.emotionalFocus,
        customPrompt,
        presetBlueprint: request.presetBlueprint,
        preferences: request.preferences,
      },
    );
  }

  /**
   * Transforms incoming Story Request data into the strictly typed AI-ready StoryContext.
   */
  build(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
    extra?: {
      childName?: string;
      emotionalFocus?: string[];
      customPrompt?: string;
      presetBlueprint?: Record<string, any>;
      preferences?: Record<string, any>;
    },
  ): StoryContext {
    const rawCustomPrompt =
      extra?.customPrompt ||
      (typeof extra?.preferences?.customPrompt === 'string'
        ? extra.preferences.customPrompt
        : undefined);

    const customPrompt =
      typeof rawCustomPrompt === 'string' && rawCustomPrompt.trim().length > 0
        ? rawCustomPrompt.trim()
        : undefined;

    return {
      targetAge: childAge,
      language,
      theme,
      selGoal,
      readingLevel,
      childName: extra?.childName,
      emotionalFocus: extra?.emotionalFocus,
      customPrompt,
      presetBlueprint: extra?.presetBlueprint,
      preferences: extra?.preferences,
    };
  }
}

