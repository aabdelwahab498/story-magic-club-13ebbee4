import { Test, TestingModule } from '@nestjs/testing';
import { StoryDirectorService } from './story-director.service.js';

describe('StoryDirectorService', () => {
  let service: StoryDirectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoryDirectorService],
    }).compile();

    service = module.get<StoryDirectorService>(StoryDirectorService);
  });

  it('should derive a StoryContract for the Omar & lost star acceptance brief', () => {
    const prompt =
      "Write a warm and exciting children's adventure story about Omar, a curious 7-year-old boy, who discovers a tiny glowing star that has lost its way back to the sky in his garden. Omar decides to help the little star find its way home. Throughout the journey, Omar learns about courage, kindness, helping others, and overcoming fear. In the end, the little star safely returns to the night sky.";

    const contract = service.deriveContract(prompt, 'Omar', 7);

    expect(contract.hasCustomPrompt).toBe(true);
    expect(contract.protagonistName).toBe('Omar');
    expect(contract.protagonistAge).toBe(7);
    expect(contract.keyObjects).toContain('star');
    expect(contract.keyObjects).toContain('glowing star');
    expect(contract.hardConstraints.some((c) => c.includes('Omar'))).toBe(true);
  });

  it('should handle absent customPrompt gracefully', () => {
    const contract = service.deriveContract(undefined, 'Sarah', 6);

    expect(contract.hasCustomPrompt).toBe(false);
    expect(contract.protagonistName).toBe('Sarah');
    expect(contract.keyObjects).toEqual([]);
  });
});
