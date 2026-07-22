import { Module } from '@nestjs/common';
import { UsageService } from './usage.service.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';

import { UsageController } from './usage.controller.js';

@Module({
  imports: [SupabaseModule],
  providers: [UsageService],
  controllers: [UsageController],
  exports: [UsageService],
})
export class UsageModule {}
