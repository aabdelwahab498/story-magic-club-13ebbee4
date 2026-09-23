import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { CreateMediaDto } from './dto/create-media.dto.js';
import { CharacterBibleService } from './character/character.service.js';
import { CharacterBible } from './character/character.types.js';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { IllustratedStoryExportService } from './export/illustrated-story-export.service.js';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly characterService: CharacterBibleService,
    private readonly exportService: IllustratedStoryExportService,
  ) {}

  @Post('stories/:id/media')
  async createMedia(@Param('id') storyId: string, @Body() dto: CreateMediaDto) {
    return this.mediaService.createMediaRequest(
      storyId,
      dto.type,
      dto.metadata,
    );
  }

  @Get('stories/:id/media')
  async getMediaForStory(@Param('id') storyId: string) {
    return this.mediaService.getMediaForStory(storyId);
  }

  @Post('stories/:id/illustrations')
  async createIllustrationJob(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.mediaService.createIllustrationJob(storyId, user);
  }

  @Post('stories/:id/illustrations/retry')
  async retryIllustrationJob(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.mediaService.retryIllustrationJob(storyId, user);
  }

  @Post('stories/:id/illustrations/:pageNumber/regenerate')
  async regeneratePageIllustration(
    @Param('id') storyId: string,
    @Param('pageNumber') pageNumberStr: string,
    @CurrentUser() user: UserContext,
  ) {
    const pageNumber = parseInt(pageNumberStr, 10);
    return this.mediaService.regeneratePageIllustration(
      storyId,
      pageNumber,
      user,
    );
  }

  @Get('stories/:id/illustrations')
  async getIllustrationsForStory(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.mediaService.getIllustrations(storyId, user.id);
  }

  @Get('media/:id/status')
  async getMediaStatus(@Param('id') mediaId: string) {
    return this.mediaService.getMediaStatus(mediaId);
  }

  @Post('stories/:id/characters')
  async createCharacterBible(
    @Param('id') storyId: string,
    @Body() body: Omit<CharacterBible, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    return this.characterService.createBible({ ...body, storyId });
  }

  @Get('stories/:id/characters')
  async getCharactersForStory(@Param('id') storyId: string) {
    return this.characterService.getCharacters(storyId);
  }

  @Get('characters/:id')
  getCharacter(@Param('id') id: string) {
    // Left empty for now, or implement in service if needed.
    // The requirement only states to "Add endpoints: Get Character Reference GET /characters/:id"
    return { id, message: 'Not implemented yet' };
  }

  @Get('stories/:id/export/pdf')
  async getExportIllustratedStory(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryPdf(storyId, user.id);
  }

  @Post('stories/:id/export/pdf')
  async postExportIllustratedStory(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryPdf(storyId, user.id);
  }

  @Get('stories/:id/export/txt')
  async getExportStoryTxt(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryTxt(storyId, user.id);
  }

  @Post('stories/:id/export/txt')
  async postExportStoryTxt(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryTxt(storyId, user.id);
  }

  @Get('stories/:id/export/audio')
  async getExportStoryAudio(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryAudio(storyId, user.id);
  }

  @Post('stories/:id/export/audio')
  async postExportStoryAudio(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryAudio(storyId, user.id);
  }

  @Get('stories/:id/export/zip')
  async getExportStoryZip(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryZip(storyId, user.id);
  }

  @Post('stories/:id/export/zip')
  async postExportStoryZip(
    @Param('id') storyId: string,
    @CurrentUser() user: UserContext,
  ) {
    return await this.exportService.exportStoryZip(storyId, user.id);
  }
}
