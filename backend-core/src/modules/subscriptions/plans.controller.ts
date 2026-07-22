import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('api/v2/subscriptions')
export class PlansController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getActivePlans();
  }

  @Get('compare')
  async comparePlans() {
    return this.subscriptionsService.comparePlans();
  }
}
