import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { Public } from '../../auth/public.decorator.js';

@Public()
@Controller('subscriptions')
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
