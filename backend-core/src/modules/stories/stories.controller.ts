import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator.js';
import { StoriesService } from './stories.service.js';
import { CreateStoryRequestDto } from './dto/create-story-request.dto.js';
import { CreateTrialStoryDto } from './dto/create-trial-story.dto.js';
import { UpdateStoryStatusDto } from './dto/update-story-status.dto.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

import { IllustratedStoryExportService } from '../media/export/illustrated-story-export.service.js';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly exportService: IllustratedStoryExportService,
  ) {}

  @Public()
  @Post('trial')
  async createTrialStory(
    @Body() dto: CreateTrialStoryDto,
    @Req() req?: any,
  ) {
    const ip = req?.headers?.['x-forwarded-for'] || req?.ip || '127.0.0.1';
    return this.storiesService.createTrialStory(dto, String(ip));
  }

  @Post()
  async createStory(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateStoryRequestDto,
  ) {
    return this.storiesService.createStory(user, dto);
  }

  @Get()
  async getUserStories(@CurrentUser() user: UserContext) {
    return this.storiesService.getUserStories(user);
  }

  @Get('child/:childId')
  async getStoriesByChild(
    @CurrentUser() user: UserContext,
    @Param('childId') childId: string,
  ) {
    return this.storiesService.getStoriesByChild(user, childId);
  }

  @Get(':id')
  async getStoryById(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.storiesService.getFullStoryById(user, id);
  }

  @Patch(':id/status')
  async updateStoryStatus(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: UpdateStoryStatusDto,
  ) {
    return this.storiesService.updateStoryStatus(user, id, dto.status);
  }

  @Delete(':id')
  async deleteStory(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.storiesService.deleteStory(user, id);
  }

  @Post(':id/retry')
  async retryStory(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.storiesService.retryStory(user, id);
  }

  @Post('plan')
  async planStory(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateStoryRequestDto,
  ) {
    return this.storiesService.planStory(user, dto);
  }

  @Get(':id/export/pdf')
  async getExportPdf(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryPdf(id, user.id);
  }

  @Post(':id/export/pdf')
  async postExportPdf(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryPdf(id, user.id);
  }

  @Get(':id/export/txt')
  async getExportTxt(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryTxt(id, user.id);
  }

  @Post(':id/export/txt')
  async postExportTxt(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryTxt(id, user.id);
  }

  @Get(':id/export/audio')
  async getExportAudio(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryAudio(id, user.id);
  }

  @Post(':id/export/audio')
  async postExportAudio(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryAudio(id, user.id);
  }

  @Get(':id/export/zip')
  async getExportZip(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryZip(id, user.id);
  }

  @Post(':id/export/zip')
  async postExportZip(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.exportService.exportStoryZip(id, user.id);
  }
}
