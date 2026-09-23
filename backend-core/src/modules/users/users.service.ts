// src/modules/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type { UpdateProfileDto } from './dto/index.js';
import type { UserProfile } from './interfaces/index.js';
import { Language } from './enums/index.js';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // User profile methods
  async getProfile(userId: string, email: string): Promise<UserProfile> {
    const client = this.supabaseService.getUserClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('User profile not found');
      }
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new NotFoundException('User profile not found');
    }

    return {
      id: data.id as string,
      email,
      displayName: (data.display_name as string) ?? '',
      language: data.preferred_language as Language,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  async updateProfile(
    userId: string,
    email: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const client = this.supabaseService.getUserClient();

    // Verify it exists
    await this.getProfile(userId, email);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.displayName !== undefined) updates.display_name = dto.displayName;
    if (dto.language !== undefined) updates.preferred_language = dto.language;

    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      id: data.id as string,
      email,
      displayName: (data.display_name as string) ?? '',
      language: data.preferred_language as Language,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}
