import { Test, TestingModule } from '@nestjs/testing';
import { CharacterExtractor } from './character.extractor.js';

describe('CharacterExtractor', () => {
  let extractor: CharacterExtractor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CharacterExtractor],
    }).compile();

    extractor = module.get<CharacterExtractor>(CharacterExtractor);
  });

  it('should detect main character Lina', () => {
    const pages = [
      { text: 'Lina went to the magical forest wearing a dress.' },
    ];
    const characters = extractor.extractCharacters(pages);

    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('Lina');
    expect(characters[0].appearance.hair).toBe('black curly');
  });

  it('should fallback to generic character if none found', () => {
    const pages = [{ text: 'A small cat walked on the roof.' }];
    const characters = extractor.extractCharacters(pages);

    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('Protagonist');
  });

  it('should handle boy keyword', () => {
    const pages = [{ text: 'The brave boy climbed the mountain.' }];
    const characters = extractor.extractCharacters(pages);

    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('Hero');
    expect(characters[0].appearance.hair).toBe('short brown');
  });
});
