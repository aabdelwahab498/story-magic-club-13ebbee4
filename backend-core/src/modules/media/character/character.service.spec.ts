import { Test, TestingModule } from '@nestjs/testing';
import { CharacterBibleService } from './character.service.js';
import { CharacterExtractor } from './character.extractor.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';

describe('CharacterBibleService', () => {
  let service: CharacterBibleService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterBibleService,
        CharacterExtractor,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<CharacterBibleService>(CharacterBibleService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a character bible', async () => {
    const mockBibleRow = {
      id: 'id-1',
      story_id: 'story-1',
      character_name: 'Lina',
      appearance: {},
      visual_traits: {},
      version: 1,
    };

    // The query chain is `.from().insert().select().single()`
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: mockBibleRow,
      error: null,
    });

    const result = await service.createBible({
      storyId: 'story-1',
      characterName: 'Lina',
      appearance: {},
      visualTraits: {},
      colorPalette: {},
      clothing: {},
      expressions: {},
      version: 1,
    });

    expect(result.id).toBe('id-1');
    expect(result.characterName).toBe('Lina');
    expect(mockSupabaseClient.insert).toHaveBeenCalled();
  });

  it('should retrieve existing characters', async () => {
    const mockRows = [{ id: '1', character_name: 'Lina', version: 1 }];

    // The query chain is `.from().select().eq().order()`
    // We mock order because it's the last in the chain
    mockSupabaseClient.order.mockResolvedValueOnce({
      data: mockRows,
      error: null,
    });

    const results = await service.getCharacters('story-1');
    expect(results).toHaveLength(1);
    expect(results[0].characterName).toBe('Lina');
  });

  it('should fall back gracefully to in-memory mode when character_bibles table is missing in database', async () => {
    mockSupabaseClient.order.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST205', message: "Could not find table 'character_bibles'" },
    });

    const getRes = await service.getCharacters('story-missing-table');
    expect(getRes).toEqual([]);

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST205', message: "Could not find table 'character_bibles'" },
    });

    const seedRes = await service.extractAndSeedCharacters('story-missing-table', [
      { text: 'Lina went to the magical forest.' },
    ]);

    expect(seedRes.length).toBeGreaterThan(0);
    expect(seedRes[0].characterName).toBe('Lina');
  });
});
