import { IsEnum, IsObject, IsOptional } from 'class-validator';
import type { MediaType } from '../gateway/media.gateway.js';

export class CreateMediaDto {
  @IsEnum(['ILLUSTRATION', 'AUDIO', 'PDF'])
  type: MediaType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
