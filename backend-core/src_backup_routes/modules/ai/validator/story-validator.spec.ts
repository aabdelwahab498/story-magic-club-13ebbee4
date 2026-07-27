/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { StoryValidator } from './story-validator.js';
import { StructureRule } from './rules/structure.rule.js';
import { AgeRule } from './rules/age.rule.js';
import { SelRule } from './rules/sel.rule.js';
import { SafetyRule } from './rules/safety.rule.js';

describe('StoryValidator', () => {
  let validator: StoryValidator;

  const validContext = {
    targetAge: 7,
    language: 'en',
    theme: 'space',
    selGoal: 'sharing',
    readingLevel: 'level_2',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoryValidator, StructureRule, AgeRule, SelRule, SafetyRule],
    }).compile();

    validator = module.get<StoryValidator>(StoryValidator);
  });

  it('should pass a fully valid story', () => {
    const validStory = {
      title: 'Valid Title',
      pages: [
        { pageNumber: 1, text: 'This is a nice safe text about sharing.' },
      ],
      metadata: { theme: 'space', selGoal: 'sharing' },
    };

    const result = validator.validateStory(validStory, validContext);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should fail if pages are missing', () => {
    const invalidStory = {
      title: 'Title',
      metadata: { theme: 'space', selGoal: 'sharing' },
    } as any;

    const result = validator.validateStory(invalidStory, validContext);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Story pages array is missing or invalid.');
  });

  it('should fail if text is empty', () => {
    const invalidStory = {
      title: 'Title',
      pages: [{ pageNumber: 1, text: '   ' }],
      metadata: { theme: 'space', selGoal: 'sharing' },
    };

    const result = validator.validateStory(invalidStory, validContext);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Page 1 has missing or empty text.');
  });

  it('should fail if SEL goal does not match', () => {
    const invalidStory = {
      title: 'Title',
      pages: [{ pageNumber: 1, text: 'Nice text.' }],
      metadata: { theme: 'space', selGoal: 'fighting' },
    };

    const result = validator.validateStory(invalidStory, validContext);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Story SEL Goal (fighting) does not match Context SEL Goal (sharing).',
    );
  });

  it('should fail if safety blocklist word is found', () => {
    const invalidStory = {
      title: 'The knife',
      pages: [{ pageNumber: 1, text: 'He found a weapon.' }],
      metadata: { theme: 'space', selGoal: 'sharing' },
    };

    const result = validator.validateStory(invalidStory, validContext);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Safety violation: Story contains inappropriate word 'knife'.",
    );
    expect(result.errors).toContain(
      "Safety violation: Story contains inappropriate word 'weapon'.",
    );
  });

  it('should warn if text is too long for age', () => {
    const longText = 'a'.repeat(600);
    const validStory = {
      title: 'Valid Title',
      pages: [{ pageNumber: 1, text: longText }],
      metadata: { theme: 'space', selGoal: 'sharing' },
    };

    // Age is 7, max chars is 500, so 600 is too long -> returns a warning.
    const result = validator.validateStory(validStory, validContext);
    expect(result.valid).toBe(true); // Warnings don't invalidate
    expect(result.warnings[0]).toContain('exceptionally long');
  });
});
