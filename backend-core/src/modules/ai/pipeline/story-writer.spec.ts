import { Test, TestingModule } from '@nestjs/testing';
import { StoryWriter } from './story-writer.js';
import { PromptBuilder } from '../prompts/prompt.builder.js';
import { LLM_PROVIDER } from '../interfaces/llm-provider.interface.js';
import {
  AIProviderException,
  AIParseException,
  AIValidationException,
} from '../exceptions/ai.exceptions.js';

describe('StoryWriter', () => {
  let writer: StoryWriter;
  let mockLlmProvider: any;

  const mockContext = {
    targetAge: 7,
    language: 'en',
    theme: 'space',
    selGoal: 'sharing',
    readingLevel: 'level_2',
  };
  const mockPlan = {
    title: 'T',
    characters: [],
    conflict: 'C',
    resolution: 'R',
    selGoals: ['G'],
    pageCount: 2,
  };

  beforeEach(async () => {
    mockLlmProvider = {
      generateBlueprint: jest.fn(),
      generateStory: jest.fn().mockResolvedValue(
        JSON.stringify({
          title: 'Mock Generated Story',
          pages: [
            { pageNumber: 1, text: 'This is the first page of the story.' },
          ],
          metadata: { theme: 'space', selGoal: 'sharing' },
        }),
      ),
      evaluateQuality: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryWriter,
        PromptBuilder,
        { provide: LLM_PROVIDER, useValue: mockLlmProvider },
      ],
    }).compile();

    writer = module.get<StoryWriter>(StoryWriter);
  });

  it('should return a valid GeneratedStory', async () => {
    const story = await writer.writeStory(mockContext, mockPlan);
    expect(story.title).toBe('Mock Generated Story');
    expect(story.pages.length).toBe(1);
    expect(mockLlmProvider.generateStory).toHaveBeenCalled();
  });

  it('should throw AIProviderException if provider fails', async () => {
    mockLlmProvider.generateStory.mockRejectedValue(new Error('Network error'));
    await expect(writer.writeStory(mockContext, mockPlan)).rejects.toThrow(
      AIProviderException,
    );
  });

  it('should throw AIParseException if JSON is malformed', async () => {
    mockLlmProvider.generateStory.mockResolvedValue('{ bad json ');
    await expect(writer.writeStory(mockContext, mockPlan)).rejects.toThrow(
      AIParseException,
    );
  });

  it('should throw AIValidationException if missing pages array', async () => {
    mockLlmProvider.generateStory.mockResolvedValue(
      JSON.stringify({
        title: 'Title',
        metadata: { theme: 'space', selGoal: 'sharing' },
        // missing pages
      }),
    );
    await expect(writer.writeStory(mockContext, mockPlan)).rejects.toThrow(
      AIValidationException,
    );
  });

  it('should throw AIValidationException if pages array is empty', async () => {
    mockLlmProvider.generateStory.mockResolvedValue(
      JSON.stringify({
        title: 'Title',
        metadata: { theme: 'space', selGoal: 'sharing' },
        pages: [],
      }),
    );
    await expect(writer.writeStory(mockContext, mockPlan)).rejects.toThrow(
      AIValidationException,
    );
  });
});
