import { Injectable, Logger } from '@nestjs/common';
import { SceneExtractorService } from './scene-extractor.service.js';
import { IllustrationPromptBuilder } from './illustration-prompt.builder.js';
import { MediaConfigService } from '../media.config.js';
import { SupabaseService } from '../../../supabase/supabase.service.js';
import { CharacterBibleService } from '../character/character.service.js';
import { IllustrationProviderFactory } from '../providers/illustration-provider.factory.js';

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
    const supabase = this.supabaseService.getAdminClient();

    try {
      // 1. Fetch story pages
      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('pages')
        .eq('id', storyId)
        .single();

      if (storyError || !story) {
        throw new Error(`Failed to fetch story ${storyId}`);
      }

      // 2. Extract scenes
      const scenes = this.sceneExtractor.extractScenes(story.pages);
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
          story.pages,
        );
      }

      // 4. Generate illustrations for all scenes
      const retryFailedOnly = metadata?.retryFailedOnly === true;
      const regeneratePage = metadata?.regeneratePage as number | undefined;

      const totalPages = scenes.length;
      let completedPages = metadata?.completedPages || 0;
      let failedPages = metadata?.failedPages || 0;

      // Setup the base pages array
      let pages = [];
      if (retryFailedOnly) {
        // Filter out any pages that we will retry, keeping only the ones we won't retry
        pages = (metadata?.pages || []).filter(
          (p: any) => p.status === 'COMPLETED',
        );
        completedPages = pages.length; // Only successfully completed pages carry over
        failedPages = 0; // We are about to retry the rest
      } else if (regeneratePage !== undefined) {
        // Keep all existing pages except the one we are regenerating
        pages = (metadata?.pages || []).filter(
          (p: any) => p.pageNumber !== regeneratePage,
        );
        // Recalculate stats
        completedPages = pages.filter(
          (p: any) => p.status === 'COMPLETED',
        ).length;
        failedPages = pages.filter((p: any) => p.status === 'FAILED').length;
      }

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

        // Skip if retrying and this page is already completed
        if (
          retryFailedOnly &&
          pages.some((p: any) => p.pageNumber === scene.pageNumber)
        ) {
          continue;
        }
        try {
          const prompt = this.promptBuilder.buildPrompt(scene, characters);
          const result = await provider.generateIllustration!(prompt, metadata);

          pages.push({
            pageNumber: scene.pageNumber,
            imageUrl: result.url,
            status: 'COMPLETED',
          });
          completedPages++;
        } catch (sceneError: any) {
          this.logger.error(
            `[ILLUSTRATION:${storyId}] Failed to generate page ${scene.pageNumber}`,
            sceneError,
          );
          pages.push({
            pageNumber: scene.pageNumber,
            imageUrl: null,
            status: 'FAILED',
          });
          failedPages++;
        }

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
      const finalStatus = failedPages === totalPages ? 'FAILED' : 'COMPLETED';

      await supabase
        .from('story_media')
        .update({
          status: finalStatus,
          provider: this.mediaConfig.getImageProvider(),
        })
        .eq('id', mediaRecordId);

      this.logger.log(
        `[ILLUSTRATION:${storyId}] Completed illustration generation (${completedPages}/${totalPages})`,
      );
      return pages[0]?.imageUrl || '';
    } catch (error: any) {
      this.logger.error(`[ILLUSTRATION:${storyId}] Pipeline failed`, error);
      await supabase
        .from('story_media')
        .update({ status: 'FAILED', failure_reason: error.message })
        .eq('id', mediaRecordId);
      throw error;
    }
  }
}
