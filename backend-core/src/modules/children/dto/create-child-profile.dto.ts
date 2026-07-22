// src/modules/users/dto/create-child-profile.dto.ts
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReadingLevel } from '../enums/index.js';
import { Language } from '../../users/enums/index.js';

export class CreateChildProfileDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(18)
  age!: number;

  @IsEnum(Language)
  language!: Language;

  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @IsArray()
  @IsString({ each: true })
  emotionalGoals!: string[];

  @IsEnum(ReadingLevel)
  readingLevel!: ReadingLevel;
}
