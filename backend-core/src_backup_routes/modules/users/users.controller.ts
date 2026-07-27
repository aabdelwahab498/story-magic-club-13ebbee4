// src/modules/users/users.controller.ts
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { UsersService } from './users.service.js';
import type { UpdateProfileDto } from './dto/index.js';
import type { UserProfile } from './interfaces/index.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // User profile
  @Get('me')
  async getProfile(@CurrentUser() user: UserContext): Promise<UserProfile> {
    return this.usersService.getProfile(user.id, user.email);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(user.id, user.email, dto);
  }
}
