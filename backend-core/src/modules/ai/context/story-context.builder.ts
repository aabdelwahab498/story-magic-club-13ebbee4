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
    const childContext = await this.childrenAiContextService.buildContext(
      user,
      request.childId,
    );

    return this.build(
      childContext.age || 5, // Fallback if age is not set
      request.language,
      request.theme,
      request.selGoal,
      request.readingLevel,
      typeof request.preferences?.customPrompt === 'string'
        ? request.preferences.customPrompt
        : undefined,
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
    customPrompt?: string,
  ): StoryContext {
    return {
      targetAge: childAge,
      language,
      theme,
      selGoal,
      readingLevel,
      ...(customPrompt?.trim() ? { customPrompt: customPrompt.trim() } : {}),
    };
  }
}
