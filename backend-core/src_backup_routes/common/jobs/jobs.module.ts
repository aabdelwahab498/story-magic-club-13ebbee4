import { Global, Module } from '@nestjs/common';
import { SyncJobDispatcher } from './sync-job-dispatcher.js';

@Global()
@Module({
  providers: [
    {
      provide: 'JobDispatcher',
      useClass: SyncJobDispatcher,
    },
  ],
  exports: ['JobDispatcher'],
})
export class JobsModule {}
