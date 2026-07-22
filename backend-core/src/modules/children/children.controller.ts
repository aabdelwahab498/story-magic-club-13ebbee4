// src/modules/children/children.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ChildrenService } from './children.service.js';
import type {
  CreateChildProfileDto,
  UpdateChildProfileDto,
} from './dto/index.js';
import type { ChildProfile } from './interfaces/index.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

@Controller('api/v2/users/me/children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get()
  async getChildren(@CurrentUser() user: UserContext): Promise<ChildProfile[]> {
    return this.childrenService.getChildren(user.id);
  }

  @Post()
  async createChild(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateChildProfileDto,
  ): Promise<ChildProfile> {
    return this.childrenService.createChild(user.id, dto);
  }

  @Get(':id')
  async getChild(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ): Promise<ChildProfile> {
    return this.childrenService.getChild(user.id, id);
  }

  @Patch(':id')
  async updateChild(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: UpdateChildProfileDto,
  ): Promise<ChildProfile> {
    return this.childrenService.updateChild(user.id, id, dto);
  }

  @Delete(':id')
  async deleteChild(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.childrenService.deleteChild(user.id, id);
  }
}
