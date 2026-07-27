// src/modules/users/dto/create-profile.dto.ts
import { IsString, IsOptional, Length, IsEnum } from 'class-validator';
import { Language } from '../enums/index.js';

export class CreateProfileDto {
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}
