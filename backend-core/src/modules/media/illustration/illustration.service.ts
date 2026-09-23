import { Injectable, Logger } from '@nestjs/common';
import { SceneExtractorService } from './scene-extractor.service.js';
import { IllustrationPromptBuilder } from './illustration-prompt.builder.js';
import { MediaConfigService } from '../media.config.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CharacterBibleService } from '../character/character.service.js';
import { IllustrationProviderFactory } from '../providers/illustration-provider.factory.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../common/resilience/provider-error.classifier.js';

@Injectable()
export class IllustrationService {
  private readonly logger = new Logger(IllustrationService.name);

  constructor(
    private readonly sceneExtractor: SceneExtractorService,
    private readonly promptBuilder: IllustrationPromptBuilder,
    private readonly mediaConfig: MediaConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly characterService: CharacterBibleService,
    private readonly providerFactory: IllustrationProviderFactory,
  ) {}


  private getProvider() {
    return this.providerFactory.getProvider();
  }
  /**
   * Orchestrates the illustration generation pipeline for a specific story.
   */
  async generateIllustrations(
    storyId: string,
    mediaRecordId: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.log(
      `[ILLUSTRATION:${storyId}] Starting illustration generation pipeline`,
    );
    const supabase = this.supabaseService.getUserClient();

    try {
      // 1. Fetch story pages from ai_story_history
      let storyPages: any[] | null = null;
      const { data: histStory } = await supabase
        .from('ai_story_history')
        .select('pages, generated_story')
        .eq('id', storyId)
        .maybeSingle();

      if (histStory) {
        storyPages = histStory.generated_story?.pages || histStory.pages || null;
      }

      if (!storyPages) {
        throw new Error(`Failed to fetch story ${storyId}`);
      }

      // 2. Extract scenes
      const scenes = this.sceneExtractor.extractScenes(storyPages);
      if (scenes.length === 0) {
        this.logger.warn(
          `[ILLUSTRATION:${storyId}] No scenes extracted. Generating generic cover.`,
        );
        // Fallback generic scene
        scenes.push({
          pageNumber: 0,
          sceneDescription: 'A generic magical story cover',
          characters: [],
          environment: 'Magical environment',
          emotion: 'Happy',
        });
      }

      // 3. Check for existing Character Bibles, or create them
      let characters = await this.characterService.getCharacters(storyId);
      if (characters.length === 0) {
        characters = await this.characterService.extractAndSeedCharacters(
          storyId,
          storyPages,
        );
      }

      // 4. Generate illustrations for all scenes
      const retryFailedOnly = metadata?.retryFailedOnly === true;
      const regeneratePage = metadata?.regeneratePage as number | undefined;

      const totalPages = scenes.length;
      let pages: any[] = Array.isArray(metadata?.pages) ? [...metadata.pages] : [];

      if (retryFailedOnly) {
        // Keep only successfully completed pages
        pages = pages.filter((p: any) => p.status === 'COMPLETED' && p.imageUrl);
      } else if (regeneratePage !== undefined) {
        // Keep all existing pages except the one we are regenerating
        pages = pages.filter((p: any) => p.pageNumber !== regeneratePage);
      }

      let completedPages = pages.filter((p: any) => p.status === 'COMPLETED').length;
      let failedPages = pages.filter((p: any) => p.status === 'FAILED').length;

      let currentMetadata = {
        ...metadata,
        totalPages,
        completedPages,
        failedPages,
        pages,
      };

      await supabase
        .from('story_media')
        .update({ metadata: currentMetadata })
        .eq('id', mediaRecordId);

      const provider = this.getProvider();

      for (const scene of scenes) {
        // If we are regenerating a single page, skip all other scenes
        if (
          regeneratePage !== undefined &&
          scene.pageNumber !== regeneratePage
        ) {
          continue;
        }

        // Idempotency: Skip if page already has a successful completed illustration
        const existingCompleted = pages.find(
          (p: any) =>
            p.pageNumber === scene.pageNumber &&
            p.status === 'COMPLETED' &&
            p.imageUrl,
        );
        if (existingCompleted) {
          this.logger.log(
            `[ILLUSTRATION:${storyId}] Page ${scene.pageNumber} already completed with image. Skipping generation.`,
          );
          continue;
        }

        // Remove any previous failed attempt for this page
        pages = pages.filter((p: any) => p.pageNumber !== scene.pageNumber);

        try {
          const prompt = this.promptBuilder.buildPrompt(scene, characters);
          const pageMetadata = {
            ...metadata,
            storyId,
            pageNumber: scene.pageNumber,
          };
          const result = await provider.generateIllustration!(
            prompt,
            pageMetadata,
          );

          pages.push({
            pageNumber: scene.pageNumber,
            imageUrl: result.url,
            status: 'COMPLETED',
          });
        } catch (sceneError: any) {
          const classified = classifyProviderError(sceneError);
          const sanitizedMsg = sanitizeSecrets(classified.message);
          this.logger.error(
            `[ILLUSTRATION:${storyId}] Failed to generate page ${scene.pageNumber} [Category: ${classified.category}, Status: ${classified.statusCode || 'N/A'}, Retryable: ${classified.isRetryable}]: ${sanitizedMsg}`,
          );
          pages.push({
            pageNumber: scene.pageNumber,
            imageUrl: null,
            status: 'FAILED',
          });
        }

        pages.sort((a: any, b: any) => a.pageNumber - b.pageNumber);
        completedPages = pages.filter((p: any) => p.status === 'COMPLETED').length;
        failedPages = pages.filter((p: any) => p.status === 'FAILED').length;

        currentMetadata = {
          ...metadata,
          totalPages,
          completedPages,
          failedPages,
          pages,
        };

        await supabase
          .from('story_media')
          .update({ metadata: currentMetadata })
          .eq('id', mediaRecordId);
      }

      // 6. Finalize story_media record
      completedPages = pages.filter((p: any) => p.status === 'COMPLETED').length;
      failedPages = pages.filter((p: any) => p.status === 'FAILED').length;
      const finalStatus = failedPages > 0 ? 'FAILED' : 'COMPLETED';

      await supabase
        .from('story_media')
        .update({
          status: finalStatus,
          provider: this.mediaConfig.getImageProvider(),
        })
        .eq('id', mediaRecordId);

      this.logger.log(
        `[ILLUSTRATION:${storyId}] Finished illustration cycle (${completedPages}/${totalPages} completed, ${failedPages} failed, status: ${finalStatus})`,
      );
      const firstCompleted = pages.find((p: any) => p.status === 'COMPLETED');
      return firstCompleted?.imageUrl || '';
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);
      this.logger.error(
        `[ILLUSTRATION:${storyId}] Pipeline failed [Category: ${classified.category}]: ${sanitizedMsg}`,
      );
      await supabase
        .from('story_media')
        .update({ status: 'FAILED', failure_reason: sanitizedMsg })
        .eq('id', mediaRecordId);
      throw error;
    }
  }
}
