import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';

import { CreditsController } from './credits.controller.js';

@Module({
  imports: [SupabaseModule],
  providers: [CreditsService],
  controllers: [CreditsController],
  exports: [CreditsService],
})
export class CreditsModule {}
