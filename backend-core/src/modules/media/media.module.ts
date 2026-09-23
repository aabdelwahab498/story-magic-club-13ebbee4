import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaGateway } from './gateway/media.gateway.js';
import { MockMediaProvider } from './providers/mock-media.provider.js';
import { IllustrationService } from './illustration/illustration.service.js';
import { SceneExtractorService } from './illustration/scene-extractor.service.js';
import { IllustrationPromptBuilder } from './illustration/illustration-prompt.builder.js';
import { GoogleImageProvider } from './providers/google-image.provider.js';
import { MockIllustrationProvider } from './providers/mock-illustration.provider.js';
import { IllustrationProviderFactory } from './providers/illustration-provider.factory.js';
import { MediaConfigService } from './media.config.js';
import { CharacterBibleService } from './character/character.service.js';
import { CharacterExtractor } from './character/character.extractor.js';
import { IllustratedStoryExportService } from './export/illustrated-story-export.service.js';
import { PdfExportService } from '../pdf/pdf.service.js';
import { CreditsModule } from '../credits/credits.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

// Audio Components
import { AudioController } from './audio.controller.js';
import { AudioService } from './audio.service.js';
import { EdgeAudioProvider } from './providers/audio/edge-audio.provider.js';
import { MockAudioProvider } from './providers/audio/mock-audio.provider.js';
import { AudioProviderFactory } from './providers/audio/audio-provider.factory.js';

import { StoryMediaProcessor } from './processors/story-media.processor.js';
import { StoryExportProcessor } from './processors/story-export.processor.js';

@Module({
  imports: [CreditsModule, UsageModule, SubscriptionsModule, RbacModule],
  controllers: [MediaController, AudioController],
  providers: [
    MediaService,
    MediaGateway,
    MockMediaProvider,
    IllustrationService,
    SceneExtractorService,
    IllustrationPromptBuilder,
    GoogleImageProvider,
    MockIllustrationProvider,
    IllustrationProviderFactory,
    MediaConfigService,
    CharacterBibleService,
    CharacterExtractor,
    IllustratedStoryExportService,
    PdfExportService,
    // Audio Providers & Service
    AudioService,
    EdgeAudioProvider,
    MockAudioProvider,
    AudioProviderFactory,
    // Processors
    StoryMediaProcessor,
    StoryExportProcessor,
  ],
  exports: [MediaService, IllustratedStoryExportService, AudioService],
})
export class MediaModule {}
