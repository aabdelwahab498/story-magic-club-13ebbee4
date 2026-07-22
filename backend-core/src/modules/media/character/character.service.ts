import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CharacterBible, CharacterReference } from './character.types.js';
import { CharacterExtractor } from './character.extractor.js';

@Injectable()
export class CharacterBibleService {
  private readonly logger = new Logger(CharacterBibleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly extractor: CharacterExtractor,
  ) {}

  /**
   * Retrieves existing character bibles for a story.
   */
  async getCharacters(storyId: string): Promise<CharacterBible[]> {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('character_bibles')
      .select('*')
      .eq('story_id', storyId)
      .order('version', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch characters for story ${storyId}`,
        error,
      );
      throw error;
    }

    // Map DB snake_case to camelCase implicitly assuming it matches or map manually
    return (data || []).map((row) => this.mapRowToCharacterBible(row));
  }

  /**
   * Creates a character bible record.
   */
  async createBible(
    bible: Omit<CharacterBible, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CharacterBible> {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('character_bibles')
      .insert({
        story_id: bible.storyId,
        character_name: bible.characterName,
        role: bible.role,
        description: bible.description,
        age: bible.age,
        gender: bible.gender,
        personality: bible.personality,
        appearance: bible.appearance,
        visual_traits: bible.visualTraits,
        color_palette: bible.colorPalette,
        clothing: bible.clothing,
        expressions: bible.expressions,
        reference_prompt: bible.referencePrompt,
        version: bible.version,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to create character bible for story ${bible.storyId}`,
        error,
      );
      throw error;
    }

    return this.mapRowToCharacterBible(data);
  }

  /**
   * Extracts characters from a story and seeds the character bible.
   */
  async extractAndSeedCharacters(
    storyId: string,
    pages: any[],
  ): Promise<CharacterBible[]> {
    const extracted = this.extractor.extractCharacters(pages);
    const bibles: CharacterBible[] = [];

    for (const char of extracted) {
      const prompt = `${char.name}, a ${char.role} with ${char.appearance.hair} hair and ${char.appearance.eyes || 'bright'} eyes.`;

      const bible = await this.createBible({
        storyId,
        characterName: char.name,
        role: char.role,
        appearance: char.appearance,
        visualTraits: {
          style: '3D animated',
          proportions: 'child friendly',
          features: [],
        },
        colorPalette: {},
        clothing: {},
        expressions: {},
        referencePrompt: prompt,
        version: 1,
      });
      bibles.push(bible);
    }

    return bibles;
  }

  private mapRowToCharacterBible(row: any): CharacterBible {
    return {
      id: row.id,
      storyId: row.story_id,
      characterName: row.character_name,
      role: row.role,
      description: row.description,
      age: row.age,
      gender: row.gender,
      personality: row.personality,
      appearance: row.appearance,
      visualTraits: row.visual_traits,
      colorPalette: row.color_palette,
      clothing: row.clothing,
      expressions: row.expressions,
      referencePrompt: row.reference_prompt,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
