import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { RolesGuard } from '../rbac/guards/roles.guard.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { Role } from '../rbac/enums/role.enum.js';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/overview')
  async getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('users')
  async getUsersAnalytics() {
    return this.adminService.getUsersAnalytics();
  }

  @Get('subscriptions')
  async getSubscriptionsAnalytics() {
    return this.adminService.getSubscriptionsAnalytics();
  }

  @Get('usage')
  async getAiUsageAnalytics() {
    return this.adminService.getAiUsageAnalytics();
  }
}
