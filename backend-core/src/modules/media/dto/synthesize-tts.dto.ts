import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SynthesizeTtsDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsOptional()
  character?: string;
}
