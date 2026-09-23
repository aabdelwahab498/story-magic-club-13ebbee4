import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { AudioService } from './audio.service.js';
import { SynthesizeTtsDto } from './dto/synthesize-tts.dto.js';

@Controller('media')
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
  async synthesizeTts(@Body() dto: SynthesizeTtsDto) {
    return this.audioService.synthesizeTts(dto.text, dto.language, dto.character);
  }
}
