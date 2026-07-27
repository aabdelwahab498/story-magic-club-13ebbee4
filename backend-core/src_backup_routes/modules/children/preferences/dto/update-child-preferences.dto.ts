import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateChildPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favoriteTopics?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emotionalGoals?: string[];

  @IsString()
  @IsOptional()
  storyStyle?: string;

  @IsString()
  @IsOptional()
  difficultyLevel?: string;
}
