import { Test, TestingModule } from '@nestjs/testing';
import { StoryGuardianService } from './story-guardian.service.js';
import { StoryDirectorService } from './story-director.service.js';
import { GeneratedStory, StoryContext } from '@najmah/shared';

describe('StoryGuardianService', () => {
  let guardian: StoryGuardianService;
  let director: StoryDirectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoryGuardianService, StoryDirectorService],
    }).compile();

    guardian = module.get<StoryGuardianService>(StoryGuardianService);
    director = module.get<StoryDirectorService>(StoryDirectorService);
  });

  const omarPrompt =
    "Write a warm and exciting children's adventure story about Omar, a curious 7-year-old boy, who discovers a tiny glowing star that has lost its way back to the sky in his garden. Omar decides to help the little star find its way home. Throughout the journey, Omar learns about courage, kindness, helping others, and overcoming fear. In the end, the little star safely returns to the night sky.";

  it('REGRESSION: should APPROVE a story faithful to Omar & the glowing star', () => {
    const contract = director.deriveContract(omarPrompt, 'Omar', 7);
    const context: StoryContext & { contract?: any } = {
      targetAge: 7,
      language: 'en',
      readingLevel: 'level_2',
      theme: 'adventure',
      selGoal: 'courage',
      customPrompt: omarPrompt,
      contract,
    };

    const validStory: GeneratedStory = {
      title: 'Omar and the Lost Star',
      pages: [
        {
          pageNumber: 1,
          text: 'Omar was walking in his garden when he found a tiny glowing star lying on a leaf.',
        },
        {
          pageNumber: 2,
          text: 'Omar decided to help the little star find its way back to the night sky.',
        },
      ],
      metadata: { theme: 'adventure', selGoal: 'courage' },
    };

    const result = guardian.validate(validStory, context);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('REGRESSION: should REJECT an unrelated story like "Leo\'s Big Backyard Safari"', () => {
    const contract = director.deriveContract(omarPrompt, 'Omar', 7);
    const context: StoryContext & { contract?: any } = {
      targetAge: 7,
      language: 'en',
      readingLevel: 'level_2',
      theme: 'adventure',
      selGoal: 'courage',
      customPrompt: omarPrompt,
      contract,
    };

    const leoStory: GeneratedStory = {
      title: "Leo's Big Backyard Safari",
      pages: [
        {
          pageNumber: 1,
          text: 'Leo and Pip went on a safari in the backyard looking for the Golden Acorn.',
        },
        {
          pageNumber: 2,
          text: 'They found the Golden Acorn near the tree.',
        },
      ],
      metadata: { theme: 'safari', selGoal: 'sharing' },
    };

    const result = guardian.validate(leoStory, context);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Leo') || e.includes('Omar'))).toBe(true);
  });
});
