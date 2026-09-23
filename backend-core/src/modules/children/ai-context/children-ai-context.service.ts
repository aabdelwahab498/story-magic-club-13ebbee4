import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { ChildPreferencesService } from '../preferences/preferences.service.js';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';

export interface ChildAIContext {
  age: number | null;
  language: string;
  readingLevel: string | null;
  interests: string[];
  emotionalGoals: string[];
  preferences: {
    favoriteTopics: string[];
    storyStyle?: string;
    difficultyLevel?: string;
  };
  learningHistory: Array<{
    previousLevel: string;
    newLevel: string;
    reason: string | null;
    date: string;
  }>;
}

@Injectable()
export class ChildrenAIContextService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly preferencesService: ChildPreferencesService,
  ) {}

  async buildContext(
    user: UserContext,
    childId: string,
  ): Promise<ChildAIContext> {
    const { data: profile, error } = await this.supabase
      .getUserClient()
      .from('child_profiles')
      .select('age, preferred_language, reading_level')
      .eq('id', childId)
      .eq('parent_user_id', user.id)
      .single();

    if (error || !profile) {
      throw new NotFoundException('Child profile not found');
    }

    const preferences = await this.preferencesService.getPreferences(
      user,
      childId,
    );

    const { data: progress } = await this.supabase
      .getUserClient()
      .from('child_learning_progress')
      .select('previous_level, new_level, reason, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10);

    const learningHistory = (progress || []).map((p) => ({
      previousLevel: p.previous_level,
      newLevel: p.new_level,
      reason: p.reason,
      date: p.created_at,
    }));

    return {
      age: profile.age,
      language: profile.preferred_language,
      readingLevel: profile.reading_level,
      interests: preferences.interests || [],
      emotionalGoals: preferences.emotionalGoals || [],
      preferences: {
        favoriteTopics: preferences.favoriteTopics || [],
        storyStyle: preferences.storyStyle,
        difficultyLevel: preferences.difficultyLevel,
      },
      learningHistory,
    };
  }
}
