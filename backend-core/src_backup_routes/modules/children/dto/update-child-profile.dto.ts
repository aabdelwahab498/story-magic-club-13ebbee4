// src/modules/users/dto/update-child-profile.dto.ts
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  IsOptional,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReadingLevel } from '../enums/index.js';
import { Language } from '../../users/enums/index.js';

export class UpdateChildProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(18)
  age?: number;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emotionalGoals?: string[];

  @IsOptional()
  @IsEnum(ReadingLevel)
  readingLevel?: ReadingLevel;
}
