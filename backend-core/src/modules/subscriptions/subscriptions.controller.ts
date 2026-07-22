import { Controller, Get } from '@nestjs/common';
import {
  SubscriptionsService,
  UserSubscription,
} from './subscriptions.service.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

@Controller('api/v2/users/me')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('subscription')
  async getSubscription(
    @CurrentUser() user: UserContext,
  ): Promise<UserSubscription> {
    return this.subscriptionsService.getUserSubscription(user.id);
  }

  @Get('features')
  async getFeatures(
    @CurrentUser() user: UserContext,
  ): Promise<Record<string, boolean>> {
    const sub = await this.subscriptionsService.getUserSubscription(user.id);
    const featureMap: Record<string, boolean> = {};

    // We assume these are the core features we care about returning
    const allFeatures = [
      'STORY_GENERATION',
      'ILLUSTRATION_GENERATION',
      'PDF_EXPORT',
      'REGENERATE_ILLUSTRATION',
    ];

    for (const f of allFeatures) {
      featureMap[f] = sub.features.includes(f);
    }

    return featureMap;
  }
}
