import * as crypto from 'crypto';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { StoryMetadata } from '../interfaces/story-metadata.interface.js';
import { StoryStatus } from '../enums/story-status.enum.js';
import { CreateStoryRequestDto } from '../dto/create-story-request.dto.js';
import { GeneratedStory } from '../../ai/interfaces/generated-story.interface.js';

@Injectable()
export class StoriesRepository {
  private readonly logger = new Logger(StoriesRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createRequest(
    userId: string,
    dto: CreateStoryRequestDto,
    readingLevel: string,
  ): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .insert({
        user_id: userId,
        child_id: dto.childId || null,
        theme: dto.theme,
        sel_goal: dto.selGoal,
        language: dto.language,
        reading_level: readingLevel,
        page_count: dto.pageCount || 5,
        estimated_reading_time: dto.estimatedReadingTime || 5,
        status: StoryStatus.DRAFT,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to create story request');
    }

    const metadata = this.mapToMetadata(data);
    metadata.childName = dto.childName;
    metadata.age = dto.age;
    const rawCustomPrompt =
      dto.customPrompt ||
      (typeof dto.preferences?.customPrompt === 'string'
        ? dto.preferences.customPrompt
        : undefined);
    metadata.customPrompt =
      typeof rawCustomPrompt === 'string' && rawCustomPrompt.trim().length > 0
        ? rawCustomPrompt.trim()
        : undefined;
    metadata.presetBlueprint = dto.presetBlueprint;
    metadata.preferences = dto.preferences;
    return metadata;
  }

  async findByChild(userId: string, childId: string): Promise<StoryMetadata[]> {
    const { data, error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('child_id', childId);

    if (error) {
      throw new InternalServerErrorException('Failed to fetch stories');
    }

    return (data || []).map((row: any) => this.mapToMetadata(row));
  }

  async findAllByUser(userId: string): Promise<StoryMetadata[]> {
    const { data, error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch stories');
    }

    const canonicalStories = (data || []).map((row: any) =>
      this.mapToMetadata(row),
    );
    const canonicalIds = new Set(canonicalStories.map((s) => s.id));

    try {
      const { data: legacyData } = await this.supabase
        .getUserClient()
        .from('ai_story_history')
        .select('*')
        .eq('user_id', userId);

      if (legacyData && legacyData.length > 0) {
        for (const row of legacyData) {
          if (!canonicalIds.has(row.id)) {
            this.logger.warn(
              `[LEGACY_FALLBACK] Story ${row.id} included in user stories from legacy ai_story_history table`,
            );
            canonicalStories.push(this.mapLegacyToMetadata(row));
          }
        }
      }
    } catch {
      // Ignore legacy fetch failure so canonical response is not broken
    }

    return canonicalStories;
  }

  async getFullStory(
    userId: string,
    id: string,
  ): Promise<{ metadata: StoryMetadata; content: any }> {
    try {
      const metadata = await this.findById(userId, id);
      let content = null;

      if (metadata.status === StoryStatus.GENERATED) {
        const { data, error } = await this.supabase
          .getUserClient()
          .from('ai_story_history')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          content = {
            id: data.id,
            request_id: data.id,
            title: data.title || 'Untitled Story',
            pages: data.generated_story?.pages || data.pages || [],
            metadata: data.sel_outcome || data.metadata || {},
          };
        }
      }

      return { metadata, content };
    } catch (err) {
      if (err instanceof NotFoundException) {
        const { data: legacyData, error: legacyErr } = await this.supabase
          .getUserClient()
          .from('ai_story_history')
          .select('*')
          .eq('id', id)
          .single();

        if (!legacyErr && legacyData) {
          if (legacyData.user_id && legacyData.user_id !== userId) {
            throw new NotFoundException('Story request not found');
          }
          this.logger.warn(
            `[LEGACY_FALLBACK] Story ${id} resolved from legacy ai_story_history table`,
          );
          const metadata = this.mapLegacyToMetadata(legacyData);
          const content = {
            id: legacyData.id,
            request_id: legacyData.id,
            title:
              legacyData.title ||
              legacyData.generated_story?.title ||
              'Untitled Story',
            pages:
              legacyData.generated_story?.pages || legacyData.pages || [],
            metadata: legacyData.metadata || {},
          };
          return { metadata, content };
        }
      }
      throw err;
    }
  }

  async findById(userId: string, id: string): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single();

    if (!error && data) {
      return this.mapToMetadata(data);
    }

    const { data: legacyData, error: legacyErr } = await this.supabase
      .getUserClient()
      .from('ai_story_history')
      .select('*')
      .eq('id', id)
      .single();

    if (!legacyErr && legacyData) {
      if (legacyData.user_id && legacyData.user_id !== userId) {
        throw new NotFoundException('Story request not found');
      }
      this.logger.warn(
        `[LEGACY_FALLBACK] Story ${id} resolved from legacy ai_story_history table`,
      );
      return this.mapLegacyToMetadata(legacyData);
    }

    throw new NotFoundException('Story request not found');
  }

  async updateStatus(
    userId: string,
    id: string,
    status: StoryStatus,
  ): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .update({ status })
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Story request not found or unauthorized');
    }

    return this.mapToMetadata(data);
  }

  async saveGeneratedStory(
    userId: string,
    requestId: string,
    story: GeneratedStory,
  ): Promise<void> {
    const meta = (story.metadata || {}) as Record<string, any>;
    const selOutcome = meta.sel_outcome || {
      skill: meta.selGoal || 'Empathy',
      emotion: 'calm',
      statement: `${meta.childName || 'Hero'} learned about ${meta.selGoal || 'growth'}.`,
    };
    const charHash =
      meta.character_visual_hash ||
      crypto
        .createHash('sha256')
        .update((meta.childName || 'Hero') + (meta.theme || ''))
        .digest('hex')
        .substring(0, 16);
    const ageVal = meta.age || 6;
    const ageBand =
      meta.age_band || (ageVal <= 5 ? '3-5' : ageVal <= 8 ? '6-8' : '9-12');

    const { error } = await this.supabase
      .getUserClient()
      .from('ai_story_history')
      .upsert({
        id: requestId,
        user_id: userId,
        child_profile_id: meta.childId || null,
        title: story.title,
        generated_story: { pages: story.pages },
        pages: story.pages,
        sel_outcome: selOutcome,
        character_visual_hash: charHash,
        age_band: ageBand,
        theme: meta.theme || '',
        language: meta.language || 'en',
        safety_passed: true,
        regeneration_count: 0,
        quality_total: 20,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      this.logger.error(
        `Failed to save generated story ${requestId} to ai_story_history: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to persist generated story',
      );
    }

    this.logger.log(
      `[AI_STORY_PERSISTENCE] Successfully saved story ${requestId} to ai_story_history`,
    );
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { error } = await this.supabase
      .getUserClient()
      .from('story_requests')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException('Failed to delete story request');
    }

    try {
      await this.supabase
        .getUserClient()
        .from('ai_story_history')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);
    } catch {
      // Best effort cleanup
    }

    return true;
  }

  private mapToMetadata(row: any): StoryMetadata {
    return {
      id: row.id,
      userId: row.user_id,
      childId: row.child_id,
      status: row.status as StoryStatus,
      language: row.language,
      readingLevel: row.reading_level,
      theme: row.theme,
      selGoal: row.sel_goal,
      pageCount: row.page_count,
      estimatedReadingTime: row.estimated_reading_time,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapLegacyToMetadata(row: any): StoryMetadata {
    return {
      id: row.id,
      userId: row.user_id,
      childId: row.child_id || row.child_profile_id,
      status: StoryStatus.GENERATED,
      language: row.language || 'en',
      readingLevel: row.reading_level || 'level_1',
      theme: row.theme || '',
      selGoal: row.sel_goal || row.sel_outcome || '',
      pageCount: row.page_count || row.generated_story?.pages?.length || 5,
      estimatedReadingTime: row.estimated_reading_time || 5,
      createdAt: new Date(row.created_at || Date.now()),
      updatedAt: new Date(row.created_at || Date.now()),
    };
  }
}
