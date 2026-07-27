// src/modules/children/children.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type {
  CreateChildProfileDto,
  UpdateChildProfileDto,
} from './dto/index.js';
import type { ChildProfile } from './interfaces/index.js';
import { ReadingLevel } from './enums/index.js';
import { Language } from '../users/enums/index.js';

@Injectable()
export class ChildrenService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // Child profile methods
  private mapChildProfile(data: any): ChildProfile {
    return {
      id: data.id as string,
      userId: data.parent_user_id as string,
      name: data.name as string,
      age: (data.age as number) ?? 0,
      language: data.preferred_language as Language,
      interests: data.bedtime_preferences?.interests || [],
      emotionalGoals: Array.isArray(data.emotional_focus)
        ? data.emotional_focus
        : [],
      readingLevel:
        (data.reading_level as ReadingLevel) ?? ReadingLevel.BEGINNER,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  async getChildren(userId: string): Promise<ChildProfile[]> {
    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('child_profiles')
      .select('*')
      .eq('parent_user_id', userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return (data || []).map((row) => this.mapChildProfile(row));
  }

  async getChild(userId: string, childId: string): Promise<ChildProfile> {
    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('child_profiles')
      .select('*')
      .eq('id', childId)
      .eq('parent_user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Child profile not found');
      }
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new NotFoundException('Child profile not found');
    }

    return this.mapChildProfile(data);
  }

  async createChild(
    userId: string,
    dto: CreateChildProfileDto,
  ): Promise<ChildProfile> {
    const client = this.supabaseService.getAdminClient();

    const payload = {
      parent_user_id: userId,
      name: dto.name,
      age: dto.age,
      preferred_language: dto.language,
      reading_level: dto.readingLevel,
      emotional_focus: dto.emotionalGoals,
      bedtime_preferences: { interests: dto.interests },
    };

    const { data, error } = await client
      .from('child_profiles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return this.mapChildProfile(data);
  }

  async updateChild(
    userId: string,
    childId: string,
    dto: UpdateChildProfileDto,
  ): Promise<ChildProfile> {
    const client = this.supabaseService.getAdminClient();

    // To safely merge JSON columns and enforce ownership, we must pre-fetch
    const { data: existing, error: fetchError } = await client
      .from('child_profiles')
      .select('bedtime_preferences')
      .eq('id', childId)
      .eq('parent_user_id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new NotFoundException('Child profile not found');
      }
      throw new InternalServerErrorException(fetchError.message);
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.age !== undefined) updates.age = dto.age;
    if (dto.language !== undefined) updates.preferred_language = dto.language;
    if (dto.readingLevel !== undefined)
      updates.reading_level = dto.readingLevel;
    if (dto.emotionalGoals !== undefined)
      updates.emotional_focus = dto.emotionalGoals;
    if (dto.interests !== undefined) {
      updates.bedtime_preferences = {
        ...((existing.bedtime_preferences as object) || {}),
        interests: dto.interests,
      };
    }

    const { data, error } = await client
      .from('child_profiles')
      .update(updates)
      .eq('id', childId)
      .eq('parent_user_id', userId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return this.mapChildProfile(data);
  }

  async deleteChild(userId: string, childId: string): Promise<void> {
    const client = this.supabaseService.getAdminClient();

    // Single query delete with ownership validation
    const { error } = await client
      .from('child_profiles')
      .delete()
      .eq('id', childId)
      .eq('parent_user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Child profile not found');
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}
