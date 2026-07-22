import { SupabaseService } from '../../../supabase/supabase.service.js';
import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PdfExportService } from '../../pdf/pdf.service.js';
import { CreditsService } from '../../credits/credits.service.js';
import { UsageService } from '../../usage/usage.service.js';
import {
  CREDIT_COSTS,
  TRANSACTION_TYPES,
  USAGE_EVENTS,
} from '../../credits/credits.constants.js';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import JSZip from 'jszip';

@Injectable()
export class IllustratedStoryExportService {
  private readonly logger = new Logger(IllustratedStoryExportService.name);
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly creditsService: CreditsService,
    private readonly usageService: UsageService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly pdfExportService: PdfExportService,
    private readonly metricsService: MetricsService,
  ) {}

  private async getStoryData(storyId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Fetch story from ai_story_history or stories
    let story: any = null;
    const { data: histStory } = await supabase
      .from('ai_story_history')
      .select('id, user_id, title, generated_story, language, created_at, child_id, audio_url')
      .eq('id', storyId)
      .maybeSingle();

    if (histStory) {
      story = histStory;
    } else {
      const { data: mainStory } = await supabase
        .from('stories')
        .select('id, request_id, title, pages, metadata, created_at')
        .eq('id', storyId)
        .maybeSingle();

      if (mainStory) {
        const { data: reqData } = await supabase
          .from('story_requests')
          .select('user_id, child_id, language')
          .eq('id', mainStory.request_id || storyId)
          .maybeSingle();

        story = {
          id: mainStory.id,
          user_id: reqData?.user_id || userId,
          title: mainStory.title,
          generated_story: { pages: mainStory.pages },
          language: reqData?.language || 'en',
          created_at: mainStory.created_at,
          child_id: reqData?.child_id,
          audio_url: null,
        };
      }
    }

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.user_id !== userId) {
      throw new NotFoundException('Story not found');
    }

    // 2. Fetch Child Name
    let childName = 'Little Reader';
    if (story.child_id) {
      const { data: child } = await supabase
        .from('profiles')
        .select('display_name, first_name')
        .eq('id', story.child_id)
        .maybeSingle();

      if (child) {
        childName = child.display_name || child.first_name || 'Little Reader';
      } else {
        const { data: childRow } = await supabase
          .from('children')
          .select('name')
          .eq('id', story.child_id)
          .maybeSingle();

        if (childRow?.name) {
          childName = childRow.name;
        }
      }
    }

    // 3. Extract text pages
    let pagesText: string[] = [];
    if (Array.isArray(story.generated_story?.pages)) {
      pagesText = story.generated_story.pages.map((p: any) => p.text || p.content || '');
    } else if (story.generated_story && story.generated_story.text) {
      const fullText = story.generated_story.text as string;
      pagesText = fullText
        .split(/\n{2,}|(?<=[.!?؟])\s+/)
        .map((text) => text.trim())
        .filter((text) => text.length > 0);
    }

    // 4. Fetch Media (Illustrations & Audio)
    const { data: media } = await supabase
      .from('story_media')
      .select('metadata, type, status')
      .eq('story_id', storyId);

    const illustrationMedia = media?.find((m) => m.type === 'ILLUSTRATION');
    const audioMedia = media?.find((m) => m.type === 'AUDIO');

    const mediaMetadata = illustrationMedia?.metadata as
      | { pages?: { pageNumber: number; imageUrl: string; status: string }[] }
      | undefined;

    const audioUrl = story.audio_url || (audioMedia?.status === 'COMPLETED' ? audioMedia.metadata?.audioUrl : null);

    const pages = pagesText.map((text, i) => {
      const pageNum = i + 1;
      const illustration = mediaMetadata?.pages?.find(
        (p) => p.pageNumber === pageNum && p.status === 'COMPLETED',
      );
      return {
        pageNumber: pageNum,
        text,
        imageUrl: illustration?.imageUrl || null,
      };
    });

    return {
      storyId: story.id,
      title: story.title || 'Story',
      childName,
      language: story.language || 'en',
      createdAt: story.created_at || new Date().toISOString(),
      pages,
      audioUrl: audioUrl || null,
      mediaMetadata,
    };
  }

  async exportStoryPdf(
    storyId: string,
    userId: string,
  ): Promise<{
    status?: string;
    download_url?: string;
    progress?: { completed: number; total: number };
  }> {
    // Check feature access if subscriptions enabled
    try {
      const featureCheck = await this.subscriptionsService.canAccessFeature(userId, 'PDF_EXPORT');
      if (!featureCheck.allowed) {
        throw new Error('Feature PDF_EXPORT is not enabled for your plan.');
      }
    } catch (e: any) {
      if (e?.message?.includes('not enabled')) throw e;
    }

    const data = await this.getStoryData(storyId, userId);

    const processingPages =
      data.mediaMetadata?.pages?.filter(
        (p) => p.status === 'PENDING' || p.status === 'PROCESSING',
      ) || [];
    if (processingPages.length > 0) {
      return {
        status: 'WAITING_FOR_ILLUSTRATIONS',
        progress: {
          completed:
            data.mediaMetadata?.pages?.filter((p) => p.status === 'COMPLETED').length || 0,
          total: data.mediaMetadata?.pages?.length || 0,
        },
      };
    }

    if (data.pages.length === 0) {
      throw new NotFoundException('Story has no content');
    }

    const startTime = Date.now();
    try {
      const pdfUrl = await this.pdfExportService.exportStoryPdf(
        storyId,
        data.pages,
        {
          title: data.title,
          childName: data.childName,
          language: data.language,
          createdAt: data.createdAt,
          coverImageUrl: data.pages[0]?.imageUrl || null,
        },
      );

      try {
        await this.creditsService.consumeCredits(
          userId,
          CREDIT_COSTS.PDF_EXPORT,
          TRANSACTION_TYPES.PDF_EXPORT,
          storyId,
        );
        this.usageService.trackUsage(userId, USAGE_EVENTS.PDF_EXPORTED, storyId);
      } catch {
        /* best effort credit tracking */
      }

      return { status: 'COMPLETED', download_url: pdfUrl };
    } finally {
      this.metricsService.observeFileProcessingDuration(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  async exportStoryAudio(
    storyId: string,
    userId: string,
  ): Promise<{ status: string; download_url: string; filename: string }> {
    const data = await this.getStoryData(storyId, userId);

    if (!data.audioUrl) {
      throw new NotFoundException('Audio narration not generated for this story');
    }

    return {
      status: 'COMPLETED',
      download_url: data.audioUrl,
      filename: 'story.mp3',
    };
  }

  async exportStoryZip(
    storyId: string,
    userId: string,
  ): Promise<{ status: string; download_url: string; filename: string }> {
    const data = await this.getStoryData(storyId, userId);

    if (data.pages.length === 0) {
      throw new NotFoundException('Story has no content');
    }

    const startTime = Date.now();
    try {
      let pdfSignedUrl = '';
      try {
        const pdfRes = await this.exportStoryPdf(storyId, userId);
        pdfSignedUrl = pdfRes.download_url || '';
      } catch (err) {
        this.logger.warn(`Failed to build PDF for ZIP export: ${err}`);
      }

      const metadata = {
        storyId: data.storyId,
        title: data.title,
        childName: data.childName,
        language: data.language,
        pages: data.pages.length,
        createdAt: data.createdAt,
        illustrations: data.pages.map((p) => ({
          pageNumber: p.pageNumber,
          imageUrl: p.imageUrl || null,
        })),
        audio: data.audioUrl || null,
        version: '1.0.0',
      };

      const zip = new JSZip();
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      if (pdfSignedUrl) {
        try {
          const res = await fetch(pdfSignedUrl);
          if (res.ok) {
            const pdfBuf = await res.arrayBuffer();
            zip.file('story.pdf', pdfBuf);
          }
        } catch (e) {
          this.logger.warn(`Failed to fetch PDF buffer for ZIP: ${e}`);
        }
      }

      if (data.audioUrl) {
        try {
          const res = await fetch(data.audioUrl);
          if (res.ok) {
            const mp3Buf = await res.arrayBuffer();
            zip.file('story.mp3', mp3Buf);
          }
        } catch (e) {
          this.logger.warn(`Failed to fetch MP3 buffer for ZIP: ${e}`);
        }
      }

      for (let i = 0; i < data.pages.length; i++) {
        const page = data.pages[i];
        if (page.imageUrl) {
          try {
            const res = await fetch(page.imageUrl);
            if (res.ok) {
              const imgBuf = await res.arrayBuffer();
              const ext = page.imageUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
              if (i === 0) {
                zip.file(`cover.${ext}`, imgBuf);
              }
              zip.file(`page-${page.pageNumber}.${ext}`, imgBuf);
            }
          } catch (e) {
            this.logger.warn(`Failed to fetch page ${page.pageNumber} image for ZIP: ${e}`);
          }
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const supabase = this.supabaseService.getAdminClient();
      const bucket = 'pdf_exports';
      const filePath = `${storyId}/${Date.now()}-bundle.zip`;
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, zipBuffer, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (uploadErr) {
        this.logger.error('ZIP upload failed', uploadErr);
        throw new InternalServerErrorException('Failed to upload ZIP export');
      }

      const { data: signedData, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60 * 24);

      if (signErr || !signedData?.signedUrl) {
        throw new InternalServerErrorException('Failed to generate ZIP download URL');
      }

      return {
        status: 'COMPLETED',
        download_url: signedData.signedUrl,
        filename: 'story-bundle.zip',
      };
    } finally {
      this.metricsService.observeFileProcessingDuration(
        (Date.now() - startTime) / 1000,
      );
    }
  }
}
