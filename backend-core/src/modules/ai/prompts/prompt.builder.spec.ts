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

  it('CASE A — should include primary custom story brief when present', () => {
    const prompt = builder.buildPlannerPrompt({
      targetAge: 7,
      childName: 'Omar',
      language: 'en',
      theme: 'Adventure',
      selGoal: 'Courage',
      readingLevel: 'level_2',
      customPrompt:
        'Omar discovers a tiny glowing star in his garden and helps it return to the sky.',
    });

    expect(prompt.userPrompt).toContain('PRIMARY STORY BRIEF / PREMISE (USER REQUEST):');
    expect(prompt.userPrompt).toContain(
      'Omar discovers a tiny glowing star in his garden and helps it return to the sky.',
    );
    expect(prompt.userPrompt).toContain(
      'Treat this Primary Story Brief as the core story premise and primary direction.',
    );
  });

  it('CASE B — should maintain standard behavior when custom brief is absent', () => {
    const prompt = builder.buildPlannerPrompt({
      targetAge: 7,
      childName: 'Omar',
      language: 'en',
      theme: 'Adventure',
      selGoal: 'Courage',
      readingLevel: 'level_2',
    });

    expect(prompt.userPrompt).not.toContain('PRIMARY STORY BRIEF / PREMISE');
    expect(prompt.userPrompt).toContain('Theme: Adventure');
    expect(prompt.userPrompt).toContain('SEL Goal: Courage');
  });

  it('CASE C — should treat whitespace-only custom brief as absent', () => {
    const context = {
      targetAge: 7,
      language: 'en',
      theme: 'Adventure',
      selGoal: 'Courage',
      readingLevel: 'level_2',
      customPrompt: undefined,
    };
    const prompt = builder.buildPlannerPrompt(context);

    expect(prompt.userPrompt).not.toContain('PRIMARY STORY BRIEF / PREMISE');
    expect(prompt.userPrompt).toContain('Theme: Adventure');
  });

  it('CASE D — should preserve distinct semantics for custom brief and SEL goal', () => {
    const prompt = builder.buildPlannerPrompt({
      targetAge: 7,
      childName: 'Omar',
      language: 'en',
      theme: 'Adventure',
      selGoal: 'Empathy',
      readingLevel: 'level_2',
      customPrompt: 'Omar finds a lost dragon cub.',
    });

    expect(prompt.userPrompt).toContain('PRIMARY STORY BRIEF / PREMISE (USER REQUEST):');
    expect(prompt.userPrompt).toContain('Omar finds a lost dragon cub.');
    expect(prompt.userPrompt).toContain('SEL Goal: Empathy');
    expect(prompt.userPrompt).toContain(
      'Theme and SEL Goal should guide and enrich this premise, not replace it.',
    );
  });
});
