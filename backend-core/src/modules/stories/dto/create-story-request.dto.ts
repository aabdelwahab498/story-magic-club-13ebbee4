import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export class CreateStoryRequestDto {
  @IsString()
  @IsOptional()
  childId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  childName?: string;

  @IsNumber()
  @Min(3)
  @Max(12)
  @IsOptional()
  age?: number;

  @IsString()
  @IsNotEmpty()
  theme!: string;

  @IsString()
  @IsNotEmpty()
  selGoal!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emotionalFocus?: string[];

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsOptional()
  customPrompt?: string;

  @IsObject()
  @IsOptional()
  presetBlueprint?: Record<string, any>;

  @IsString()
  @IsOptional()
  readingLevel?: string;

  @IsNumber()
  @IsOptional()
  pageCount?: number;

  @IsNumber()
  @IsOptional()
  estimatedReadingTime?: number;

  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;
}

