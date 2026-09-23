import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.config.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { JobsModule } from './common/jobs/jobs.module.js';
import { StoriesModule } from './modules/stories/stories.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { AIModule } from './modules/ai/ai.module.js';
import { CreditsModule } from './modules/credits/credits.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    JobsModule,
    StoriesModule,
    MediaModule,
    AIModule,
    CreditsModule,
    UsageModule,
    SubscriptionsModule,
    MetricsModule,
  ],
})
export class WorkerModule {}
