import { Global, Module } from '@nestjs/common';
import { SyncJobDispatcher } from './sync-job-dispatcher.js';
import { BullMQJobDispatcher } from './bullmq-job-dispatcher.js';
import { RedisModule } from '../../modules/redis/redis.module.js';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    BullMQJobDispatcher,
    SyncJobDispatcher,
    {
      provide: 'JobDispatcher',
      useExisting: BullMQJobDispatcher,
    },
  ],
  exports: ['JobDispatcher', BullMQJobDispatcher, SyncJobDispatcher],
})
export class JobsModule {}
