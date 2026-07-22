import { Controller, Get } from '@nestjs/common';
import { UsageService } from './usage.service.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

@Controller('users/me/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  async getUsageSummary(@CurrentUser() user: UserContext) {
    return this.usageService.getUsageSummary(user.id);
  }
}
