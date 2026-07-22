import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import type { ChildPreferences } from './interfaces/child-preferences.interface.js';
import { UpdateChildPreferencesDto } from './dto/update-child-preferences.dto.js';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';

@Injectable()
export class ChildPreferencesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getPreferences(
    user: UserContext,
    childId: string,
  ): Promise<ChildPreferences> {
    const { data, error } = await this.supabase
      .getClient()
      .from('child_profiles')
      .select('bedtime_preferences, emotional_focus')
      .eq('id', childId)
      .eq('parent_user_id', user.id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Child profile not found');
    }

    const bedtime = (data.bedtime_preferences as Record<string, any>) || {};
    const emotional = (data.emotional_focus as Record<string, any>) || {};

    return {
      interests: bedtime.interests || [],
      favoriteTopics: bedtime.favorite_topics || [],
      storyStyle: bedtime.story_style,
      difficultyLevel: bedtime.difficulty_level,
      emotionalGoals: emotional.goals || [],
    };
  }

  async updatePreferences(
    user: UserContext,
    childId: string,
    dto: UpdateChildPreferencesDto,
  ): Promise<ChildPreferences> {
    const { data: existing, error: fetchError } = await this.supabase
      .getClient()
      .from('child_profiles')
      .select('bedtime_preferences, emotional_focus')
      .eq('id', childId)
      .eq('parent_user_id', user.id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException('Child profile not found');
    }

    const bedtime = (existing.bedtime_preferences as Record<string, any>) || {};
    const emotional = (existing.emotional_focus as Record<string, any>) || {};

    if (dto.interests !== undefined) bedtime.interests = dto.interests;
    if (dto.favoriteTopics !== undefined)
      bedtime.favorite_topics = dto.favoriteTopics;
    if (dto.storyStyle !== undefined) bedtime.story_style = dto.storyStyle;
    if (dto.difficultyLevel !== undefined)
      bedtime.difficulty_level = dto.difficultyLevel;
    if (dto.emotionalGoals !== undefined) emotional.goals = dto.emotionalGoals;

    const { error: updateError } = await this.supabase
      .getClient()
      .from('child_profiles')
      .update({
        bedtime_preferences: bedtime,
        emotional_focus: emotional,
      })
      .eq('id', childId)
      .eq('parent_user_id', user.id);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update preferences');
    }

    return this.getPreferences(user, childId);
  }
}
