import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateTrialStoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  childName?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(3)
  @Max(12)
  age!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  theme!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  language?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  selGoal?: string;
}
