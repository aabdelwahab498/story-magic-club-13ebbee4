import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { StoryMetadata } from '../interfaces/story-metadata.interface.js';
import { StoryStatus } from '../enums/story-status.enum.js';
import { CreateStoryRequestDto } from '../dto/create-story-request.dto.js';
import { GeneratedStory } from '../../ai/interfaces/generated-story.interface.js';

@Injectable()
export class StoriesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async createRequest(
    userId: string,
    dto: CreateStoryRequestDto,
    readingLevel: string,
  ): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getClient()
      .from('story_requests')
      .insert({
        user_id: userId,
        child_id: dto.childId,
        theme: dto.theme,
        sel_goal: dto.selGoal,
        language: dto.language,
        reading_level: readingLevel,
        page_count: dto.pageCount || 5,
        estimated_reading_time: dto.estimatedReadingTime || 5,
        preferences: dto.preferences ?? {},
        status: StoryStatus.DRAFT,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to create story request');
    }

    return this.mapToMetadata(data);
  }

  async findByChild(userId: string, childId: string): Promise<StoryMetadata[]> {
    const { data, error } = await this.supabase
      .getClient()
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
      .getClient()
      .from('story_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch stories');
    }

    return (data || []).map((row: any) => this.mapToMetadata(row));
  }

  async getFullStory(
    userId: string,
    id: string,
  ): Promise<{ metadata: StoryMetadata; content: any }> {
    const metadata = await this.findById(userId, id);
    let content = null;

    if (metadata.status === StoryStatus.GENERATED) {
      const { data, error } = await this.supabase
        .getClient()
        .from('stories')
        .select('*')
        .eq('request_id', id)
        .single();

      if (!error && data) {
        content = data;
      }
    }

    return { metadata, content };
  }

  async findById(userId: string, id: string): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getClient()
      .from('story_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Story request not found');
    }

    return this.mapToMetadata(data);
  }

  async updateStatus(
    userId: string,
    id: string,
    status: StoryStatus,
  ): Promise<StoryMetadata> {
    const { data, error } = await this.supabase
      .getClient()
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
    // We insert into `stories` table, which holds the generated content
    const { error } = await this.supabase.getClient().from('stories').insert({
      request_id: requestId,
      title: story.title,
      pages: story.pages,
      metadata: story.metadata,
    });

    if (error) {
      throw new InternalServerErrorException(
        'Failed to persist generated story',
      );
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { error } = await this.supabase
      .getClient()
      .from('story_requests')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException('Failed to delete story request');
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
      preferences:
        row.preferences && typeof row.preferences === 'object'
          ? (row.preferences as Record<string, unknown>)
          : {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
