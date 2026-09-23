import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { EmailOtpType } from '@supabase/supabase-js';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token_hash!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['signup'])
  type!: EmailOtpType;
}
