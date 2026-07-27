import { Test, TestingModule } from '@nestjs/testing';
import { IllustrationPromptBuilder } from './illustration-prompt.builder.js';
import { Scene } from './types/illustration.types.js';

describe('IllustrationPromptBuilder', () => {
  let builder: IllustrationPromptBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IllustrationPromptBuilder],
    }).compile();

    builder = module.get<IllustrationPromptBuilder>(IllustrationPromptBuilder);
  });

  it('should build a structured prompt', () => {
    const scene: Scene = {
      pageNumber: 1,
      sceneDescription: 'A scene description',
      characters: ['Hero', 'Companion'],
      environment: 'A magical forest',
      emotion: 'Joyful',
    };

    const prompt = builder.buildPrompt(scene);
    expect(prompt.characters).toBe('Hero, Companion');
    expect(prompt.environment).toBe('A magical forest');
    expect(prompt.style).toContain('High quality');
  });

  it('should compile to string correctly', () => {
    const scene: Scene = {
      pageNumber: 1,
      sceneDescription: 'Desc',
      characters: ['Hero'],
      environment: 'Castle',
      emotion: 'Brave',
    };

    const prompt = builder.buildPrompt(scene);
    const compiled = builder.compileToString(prompt);
    expect(compiled).toContain('Style:');
    expect(compiled).toContain('Hero');
    expect(compiled).toContain('Castle');
  });
});
