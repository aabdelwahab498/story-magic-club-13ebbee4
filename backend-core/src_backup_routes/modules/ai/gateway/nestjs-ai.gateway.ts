import { Injectable } from '@nestjs/common';
import { IAIGateway } from './ai-gateway.interface.js';
import { StoryContextBuilder } from '../context/story-context.builder.js';
import { StoryPlanner } from '../pipeline/story-planner.js';
import { StoryWriter } from '../pipeline/story-writer.js';
import { StoryValidator } from '../validator/story-validator.js';
import {
  GeneratedStory,
  StoryContext,
  StoryPlan,
  ValidationResult,
} from '@najmah/shared';

@Injectable()
export class NestJSAIGateway implements IAIGateway {
  constructor(
    private readonly contextBuilder: StoryContextBuilder,
    private readonly planner: StoryPlanner,
    private readonly writer: StoryWriter,
    private readonly validator: StoryValidator,
  ) {}

  buildContext(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
  ): StoryContext {
    return this.contextBuilder.build(
      childAge,
      language,
      theme,
      selGoal,
      readingLevel,
    );
  }

  async planStory(
    childAge: number,
    language: string,
    theme: string,
    selGoal: string,
    readingLevel: string,
  ): Promise<StoryPlan> {
    return this.planner.planStory(
      childAge,
      language,
      theme,
      selGoal,
      readingLevel,
    );
  }

  async writeStory(
    context: StoryContext,
    blueprint: StoryPlan,
  ): Promise<GeneratedStory> {
    return this.writer.writeStory(context, blueprint);
  }

  validateStory(
    story: GeneratedStory,
    context: StoryContext,
  ): ValidationResult {
    return this.validator.validateStory(story, context);
  }
}
