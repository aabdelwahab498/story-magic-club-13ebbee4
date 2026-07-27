// backend-core/src/modules/media/audio.controller.ts
import { Controller, Post, Get, Delete, Param, UseGuards, Body } from '@nestjs/common';
import { AudioService } from './audio.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';

@Controller('media')
@UseGuards(AuthGuard)
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('stories/:storyId/audio')
  async generateNarration(@Param('storyId') storyId: string) {
    return this.audioService.generateNarration(storyId);
  }

  @Get('stories/:storyId/audio')
  async getNarration(@Param('storyId') storyId: string) {
    return this.audioService.getNarration(storyId);
  }

  @Post('stories/:storyId/audio/retry')
  async retryNarration(@Param('storyId') storyId: string) {
    return this.audioService.retryNarration(storyId);
  }

  @Delete('stories/:storyId/audio')
  async deleteNarration(@Param('storyId') storyId: string) {
    return this.audioService.deleteNarration(storyId);
  }

  @Post('tts')
  async synthesizeTts(
    @Body() body: { text: string; language: string; character?: string },
  ) {
    return this.audioService.synthesizeTts(body.text, body.language, body.character);
  }
}
