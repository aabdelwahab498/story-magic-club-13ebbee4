import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { PlansController } from './plans.controller.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  controllers: [SubscriptionsController, PlansController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
