import { Module, forwardRef } from '@nestjs/common';

import { MockLLMProvider } from './providers/mock-llm.provider.js';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface.js';
import { StoriesModule } from '../stories/stories.module.js';
import { ChildrenModule } from '../children/children.module.js';
import { StoryContextBuilder } from './context/story-context.builder.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PromptBuilder } from './prompts/prompt.builder.js';
import { StoryPlanner } from './pipeline/story-planner.js';
import { StoryWriter } from './pipeline/story-writer.js';
import { StoryValidator } from './validator/story-validator.js';
import { StructureRule } from './validator/rules/structure.rule.js';
import { AgeRule } from './validator/rules/age.rule.js';
import { SelRule } from './validator/rules/sel.rule.js';
import { SafetyRule } from './validator/rules/safety.rule.js';
import { GeminiProvider } from './providers/gemini/gemini.provider.js';
import { AI_GATEWAY } from './gateway/ai-gateway.interface.js';
import { NestJSAIGateway } from './gateway/nestjs-ai.gateway.js';
import { PythonAIGateway } from './gateway/python-ai.gateway.js';
import { GeminiParser } from './providers/gemini/gemini.parser.js';
import { StoryGenerationOrchestrator } from './orchestrator/story-generation.orchestrator.js';

@Module({
  imports: [forwardRef(() => StoriesModule), ChildrenModule, ConfigModule],
  providers: [
    StoryContextBuilder,
    PromptBuilder,
    StoryPlanner,
    StoryWriter,
    StoryValidator,
    StructureRule,
    AgeRule,
    SelRule,
    SafetyRule,
    GeminiParser,
    GeminiProvider,
    MockLLMProvider,
    StoryGenerationOrchestrator,
    NestJSAIGateway,
    PythonAIGateway,
    {
      provide: AI_GATEWAY,
      inject: [ConfigService, NestJSAIGateway, PythonAIGateway],
      useFactory: (
        configService: ConfigService,
        nestGateway: NestJSAIGateway,
        pythonGateway: PythonAIGateway,
      ) => {
        const usePython = configService.get<string>('USE_PYTHON_AI') === 'true';
        return usePython ? pythonGateway : nestGateway;
      },
    },
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, GeminiProvider, MockLLMProvider],
      useFactory: (
        configService: ConfigService,
        geminiProvider: GeminiProvider,
        mockProvider: MockLLMProvider,
      ) => {
        const useMock =
          configService.get<string>('USE_MOCK_LLM') === 'true' ||
          configService.get<string>('NODE_ENV') === 'test';
        return useMock ? mockProvider : geminiProvider;
      },
    },
  ],
  exports: [
    StoryPlanner,
    StoryWriter,
    StoryValidator,
    StoryGenerationOrchestrator,
  ],
})
export class AIModule {}
