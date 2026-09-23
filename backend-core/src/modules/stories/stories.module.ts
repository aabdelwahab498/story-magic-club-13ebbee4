import { Module, forwardRef, Inject } from '@nestjs/common';
import { StoriesController } from './stories.controller.js';
import { StoriesService } from './stories.service.js';
import { StoriesRepository } from './repositories/stories.repository.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { ChildrenModule } from '../children/children.module.js';
import { AIModule } from '../ai/ai.module.js';
import { CreditsModule } from '../credits/credits.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { StoryLifecycleManager } from './lifecycle/story-lifecycle.manager.js';
import { StoryLifecycleLogger } from './lifecycle/story-lifecycle.logger.js';
import { StoryLifecycleEvents } from './lifecycle/story-lifecycle.events.js';
import { StoryMetricsService } from './lifecycle/story-metrics.service.js';
import { StoryGenerationJobHandler } from './jobs/story-generation.job-handler.js';
import type { JobDispatcher } from '../../common/jobs/job.interface.js';
import { MediaModule } from '../media/media.module.js';

import { StoryGenerationProcessor } from './processors/story-generation.processor.js';

@Module({
  imports: [
    SupabaseModule,
    ChildrenModule,
    forwardRef(() => AIModule),
    CreditsModule,
    UsageModule,
    SubscriptionsModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [StoriesController],
  providers: [
    StoriesService,
    StoriesRepository,
    StoryLifecycleManager,
    StoryLifecycleLogger,
    StoryLifecycleEvents,
    StoryMetricsService,
    StoryGenerationJobHandler,
    StoryGenerationProcessor,
  ],
  exports: [
    StoriesService,
    StoryLifecycleManager,
    StoryLifecycleEvents,
    StoryMetricsService,
    StoriesRepository,
  ],
})
export class StoriesModule {
  constructor(
    @Inject('JobDispatcher') dispatcher: JobDispatcher,
    handler: StoryGenerationJobHandler,
  ) {
    dispatcher.registerHandler('story-generation', handler);
  }
}
