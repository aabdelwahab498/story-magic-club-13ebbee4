import { Test, TestingModule } from '@nestjs/testing';
import { SceneExtractorService } from './scene-extractor.service.js';

describe('SceneExtractorService', () => {
  let service: SceneExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SceneExtractorService],
    }).compile();

    service = module.get<SceneExtractorService>(SceneExtractorService);
  });

  it('should extract scenes correctly', () => {
    const pages = [
      { text: 'A happy child walked into the magical forest.' },
      'A sad dog cried near the ocean.',
    ];

    const scenes = service.extractScenes(pages);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].pageNumber).toBe(1);
    expect(scenes[0].emotion).toBe('Joyful and uplifting');
    expect(scenes[0].environment).toBe('A lush, magical forest');

    expect(scenes[1].pageNumber).toBe(2);
    expect(scenes[1].emotion).toBe('Melancholy but hopeful');
    expect(scenes[1].environment).toBe('Underwater kingdom');
  });

  it('should handle empty or null pages', () => {
    expect(service.extractScenes([])).toEqual([]);
    expect(service.extractScenes(null as any)).toEqual([]);
  });
});
