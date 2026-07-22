// src/modules/users/dto/update-profile.dto.ts
import { IsString, IsOptional, Length, IsEnum } from 'class-validator';
import { Language } from '../enums/index.js';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toString().toLowerCase())
  @IsEnum(Language)
  language?: Language;
}
