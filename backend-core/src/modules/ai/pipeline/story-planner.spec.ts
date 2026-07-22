import { Test, TestingModule } from '@nestjs/testing';
import { StoryPlanner } from './story-planner.js';
import { StoryContextBuilder } from '../context/story-context.builder.js';
import { PromptBuilder } from '../prompts/prompt.builder.js';
import { LLM_PROVIDER } from '../interfaces/llm-provider.interface.js';
import {
  AIProviderException,
  AIParseException,
  AIValidationException,
} from '../exceptions/ai.exceptions.js';

describe('StoryPlanner', () => {
  let planner: StoryPlanner;
  let mockLlmProvider: any;

  beforeEach(async () => {
    mockLlmProvider = {
      generateBlueprint: jest.fn().mockResolvedValue(
        JSON.stringify({
          title: 'Title',
          characters: [],
          conflict: 'C',
          resolution: 'R',
          selGoals: ['G'],
          pageCount: 5,
        }),
      ),
      generatePage: jest.fn(),
      evaluateQuality: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryPlanner,
        {
          provide: StoryContextBuilder,
          useValue: {
            build: jest.fn().mockReturnValue({
              targetAge: 7,
              language: 'ar',
              theme: 'friendship',
              selGoal: 'confidence',
              readingLevel: 'level_2',
            }),
          },
        },
        PromptBuilder,
        { provide: LLM_PROVIDER, useValue: mockLlmProvider },
      ],
    }).compile();

    planner = module.get<StoryPlanner>(StoryPlanner);
  });

  it('should be defined', () => {
    expect(planner).toBeDefined();
  });

  it('should return a valid StoryPlan', async () => {
    const plan = await planner.planStory(
      7,
      'ar',
      'friendship',
      'confidence',
      'level_2',
    );
    expect(plan.title).toBe('Title');
    expect(plan.conflict).toBe('C');
    expect(mockLlmProvider.generateBlueprint).toHaveBeenCalled();
  });

  it('should throw AIProviderException if provider fails', async () => {
    mockLlmProvider.generateBlueprint.mockRejectedValue(
      new Error('Network error'),
    );
    await expect(
      planner.planStory(7, 'ar', 'friendship', 'confidence', 'level_2'),
    ).rejects.toThrow(AIProviderException);
  });

  it('should throw AIParseException if JSON is malformed', async () => {
    mockLlmProvider.generateBlueprint.mockResolvedValue('{ bad json ');
    await expect(
      planner.planStory(7, 'ar', 'friendship', 'confidence', 'level_2'),
    ).rejects.toThrow(AIParseException);
  });

  it('should throw AIValidationException if fields are missing', async () => {
    mockLlmProvider.generateBlueprint.mockResolvedValue(
      JSON.stringify({
        title: 'Title',
        // missing conflict and resolution
      }),
    );
    await expect(
      planner.planStory(7, 'ar', 'friendship', 'confidence', 'level_2'),
    ).rejects.toThrow(AIValidationException);
  });
});
