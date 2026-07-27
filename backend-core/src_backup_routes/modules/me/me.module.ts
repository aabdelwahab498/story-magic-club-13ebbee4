import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';

/**
 * Module for the /me identity endpoint.
 * No providers needed — the controller relies on the globally-registered
 * AuthGuard and @CurrentUser() decorator.
 */
@Module({
  controllers: [MeController],
})
export class MeModule {}
