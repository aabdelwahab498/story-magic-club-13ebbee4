import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
   * If character_bibles table is missing in database schema, falls back to in-memory mode.
   */
  async getCharacters(storyId: string): Promise<CharacterBible[]> {
    try {
      const supabase = this.supabaseService.getUserClient();
      const { data, error } = await supabase
        .from('character_bibles')
        .select('*')
        .eq('story_id', storyId)
        .order('version', { ascending: false });

      if (error) {
        this.logger.warn(
          `character_bibles table query failed for story ${storyId} (${error.message}); operating in-memory mode.`,
        );
        return [];
      }

      return (data || []).map((row) => this.mapRowToCharacterBible(row));
    } catch (err: any) {
      this.logger.warn(
        `character_bibles table query exception for story ${storyId}; operating in-memory mode.`,
        err,
      );
      return [];
    }
  }

  /**
   * Creates a character bible record.
   * If character_bibles table is missing in database schema, returns in-memory CharacterBible.
   */
  async createBible(
    bible: Omit<CharacterBible, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CharacterBible> {
    const now = new Date();
    const inMemoryBible: CharacterBible = {
      id: randomUUID(),
      storyId: bible.storyId,
      characterName: bible.characterName,
      role: bible.role,
      description: bible.description,
      age: bible.age,
      gender: bible.gender,
      personality: bible.personality,
      appearance: bible.appearance,
      visualTraits: bible.visualTraits,
      colorPalette: bible.colorPalette,
      clothing: bible.clothing,
      expressions: bible.expressions,
      referencePrompt: bible.referencePrompt,
      version: bible.version,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const supabase = this.supabaseService.getUserClient();
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
        this.logger.warn(
          `Failed to persist character bible for story ${bible.storyId} (${error?.message}); operating in-memory mode.`,
        );
        return inMemoryBible;
      }

      return this.mapRowToCharacterBible(data);
    } catch (err: any) {
      this.logger.warn(
        `Exception persisting character bible for story ${bible.storyId}; operating in-memory mode.`,
        err,
      );
      return inMemoryBible;
    }
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
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}
