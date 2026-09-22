import { Test, TestingModule } from '@nestjs/testing';
import { PromptBuilder } from './prompt.builder.js';

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilder],
    }).compile();

    builder = module.get<PromptBuilder>(PromptBuilder);
  });

  it('should be defined', () => {
    expect(builder).toBeDefined();
  });

  it('should build generated prompt', () => {
    const prompt = builder.buildPlannerPrompt({
      targetAge: 7,
      language: 'ar',
      theme: 'friendship',
      selGoal: 'confidence',
      readingLevel: 'level_2',
    });

    expect(prompt.systemPrompt).toContain('Najmah AI Story Constitution');
    expect(prompt.userPrompt).toContain('7-year-old');
    expect(prompt.userPrompt).toContain('Language: ar');
    expect(prompt.userPrompt).toContain('Theme: friendship');
    expect(prompt.userPrompt).toContain('SEL Goal: confidence');
  });

  it('should build writer prompt', () => {
    const context = {
      targetAge: 7,
      language: 'ar',
      theme: 'friendship',
      selGoal: 'confidence',
      readingLevel: 'level_2',
    };
    const plan = {
      title: 'Brave Lion',
      characters: [{ name: 'Leo', role: 'hero', description: '' }],
      conflict: 'No friends',
      resolution: 'Makes friends',
      selGoals: ['confidence'],
      pageCount: 3,
    };
    const prompt = builder.buildWriterPrompt(context, plan);

    expect(prompt.systemPrompt).toContain('writer');
    expect(prompt.userPrompt).toContain('Target Age: 7');
    expect(prompt.userPrompt).toContain('Title: Brave Lion');
    expect(prompt.userPrompt).toContain('Leo (hero)');
    expect(prompt.userPrompt).toContain('"pageNumber": 1');
  });

  it('keeps the explicit custom brief primary in planner and writer prompts', () => {
    const customPrompt =
      'Create a story about Omar and the Lost Star. Omar must remain the main character and return the star.';
    const context = {
      targetAge: 7,
      language: 'en',
      theme: 'Adventure',
      selGoal: 'courage',
      readingLevel: 'level_2',
      customPrompt,
    };
    const plan = {
      title: 'Omar and the Lost Star',
      characters: [{ name: 'Omar', role: 'hero', description: '' }],
      conflict: 'A star is missing',
      resolution: 'Omar returns it',
      selGoals: ['courage'],
      pageCount: 5,
    };

    expect(builder.buildPlannerPrompt(context).userPrompt).toContain(customPrompt);
    expect(builder.buildPlannerPrompt(context).userPrompt).toContain(
      'Never replace a protagonist explicitly named in the brief',
    );
    expect(builder.buildWriterPrompt(context, plan).userPrompt).toContain(customPrompt);
    expect(builder.buildWriterPrompt(context, plan).userPrompt).toContain(
      'must remain the protagonist on every page',
    );
  });
});
