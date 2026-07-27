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
});
