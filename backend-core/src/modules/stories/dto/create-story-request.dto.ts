import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
} from 'class-validator';

export class CreateStoryRequestDto {
  @IsString()
  @IsNotEmpty()
  childId!: string;

  @IsString()
  @IsNotEmpty()
  theme!: string;

  @IsString()
  @IsNotEmpty()
  selGoal!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

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
  preferences?: Record<string, unknown>;
}
