import { Controller, Get } from '@nestjs/common';
import { CreditsService } from './credits.service.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

@Controller('users/me/credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  async getCredits(@CurrentUser() user: UserContext) {
    return this.creditsService.getBalance(user.id);
  }
}
