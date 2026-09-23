import { SupabaseService } from '../../../supabase/supabase.service.js';
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { MediaService } from '../media.service.js';
import JSZip from 'jszip';

import { ConfigService } from '@nestjs/config';

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
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
  ) {}

  private async getStoryData(storyId: string, userId: string) {
      const supabase = this.supabaseService.getUserClient();

    // 1. Fetch story from ai_story_history + story_requests
    let story: any = null;

    const { data: histStory, error: histErr } = await supabase
      .from('ai_story_history')
      .select(
        'id, user_id, title, generated_story, pages, language, created_at, child_profile_id, audio_url',
      )
      .eq('id', storyId)
      .maybeSingle();

    if (histErr) {
      this.logger.error(
        `Error querying ai_story_history table: ${histErr.message}`,
      );
      throw new InternalServerErrorException('Failed to retrieve story data');
    }

    if (histStory) {
      const { data: reqData } = await supabase
        .from('story_requests')
        .select('user_id, child_id, language')
        .eq('id', storyId)
        .maybeSingle();

      story = {
        id: histStory.id,
        user_id: reqData?.user_id || histStory.user_id || userId,
        title: histStory.title || 'Story',
        generated_story: histStory.generated_story || {
          pages: histStory.pages || [],
        },
        language: reqData?.language || histStory.language || 'en',
        created_at: histStory.created_at,
        child_id: reqData?.child_id || histStory.child_profile_id,
        audio_url: histStory.audio_url || null,
      };
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
      .select('metadata, type, status, url')
      .eq('story_id', storyId);

    const illustrationMedia = media?.find((m) => m.type === 'ILLUSTRATION');
    const audioMedia = media?.find((m) => m.type === 'AUDIO');

    const mediaMetadata = illustrationMedia?.metadata as
      | { pages?: { pageNumber: number; imageUrl: string; status: string }[] }
      | undefined;

    const audioUrl =
      story.audio_url ||
      (audioMedia?.status === 'COMPLETED'
        ? audioMedia.url || audioMedia.metadata?.audioUrl
        : null);

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
      userId: story.user_id,
      title: story.title || 'Story',
      childName,
      language: story.language || 'en',
      createdAt: story.created_at || new Date().toISOString(),
      pages,
      audioUrl: audioUrl || null,
      audioStatus:
        audioMedia?.status || (story.audio_url ? 'COMPLETED' : 'NONE'),
      illustrationStatus: illustrationMedia?.status || 'NONE',
      mediaMetadata,
    };
  }

  async exportStoryTxt(
    storyId: string,
    userId: string,
  ): Promise<{
    status: string;
    content: string;
    filename: string;
    download_url?: string;
  }> {
    const data = await this.getStoryData(storyId, userId);

    if (data.pages.length === 0) {
      throw new NotFoundException('Story has no content');
    }

    const safeTitle =
      data.title
        .replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'story';

    let textContent = `${data.title.trim()}\n`;
    if (data.childName && data.childName !== 'Little Reader') {
      textContent += `For: ${data.childName}\n`;
    }
    textContent += `\n${'='.repeat(40)}\n\n`;

    data.pages.forEach((page, index) => {
      const pageNum = page.pageNumber || index + 1;
      textContent += `[Page ${pageNum}]\n${page.text.trim()}\n\n`;
    });

    let downloadUrl: string | undefined = undefined;
    try {
        const supabase = this.supabaseService.getUserClient();
      const bucket = this.configService.get<string>('EXPORTS_BUCKET', 'story-pdfs');
      const ownerId = data.userId || userId;
      const filePath = `${ownerId}/${storyId}/${Date.now()}-${safeTitle}.txt`;
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, Buffer.from(textContent, 'utf-8'), {
          contentType: 'text/plain; charset=utf-8',
          upsert: true,
        });

      if (!uploadErr) {
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24);
        if (signedData?.signedUrl) {
          downloadUrl = signedData.signedUrl;
        }
      }
    } catch (err) {
      this.logger.warn(`Storage upload for TXT export failed: ${err}`);
    }

    return {
      status: 'COMPLETED',
      content: textContent,
      filename: `${safeTitle}.txt`,
      ...(downloadUrl ? { download_url: downloadUrl } : {}),
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

    // 1. If illustration job does not exist yet, auto-trigger it
    if (data.illustrationStatus === 'NONE') {
      try {
        this.logger.log(
          `No illustration job found for PDF export of story ${storyId}. Auto-triggering illustration job.`,
        );
        await this.mediaService.createIllustrationJob(storyId, userId);
      } catch (err: any) {
        this.logger.warn(
          `Failed to auto-trigger illustration job during PDF export: ${err.message}`,
        );
      }
      return {
        status: 'WAITING_FOR_ILLUSTRATIONS',
        progress: { completed: 0, total: data.pages.length },
      };
    }

    // 2. If illustration job is PENDING or PROCESSING, or individual pages are in progress
    const processingPages =
      data.mediaMetadata?.pages?.filter(
        (p) => p.status === 'PENDING' || p.status === 'PROCESSING',
      ) || [];
    if (
      data.illustrationStatus === 'PENDING' ||
      data.illustrationStatus === 'PROCESSING' ||
      processingPages.length > 0
    ) {
      return {
        status: 'WAITING_FOR_ILLUSTRATIONS',
        progress: {
          completed:
            data.mediaMetadata?.pages?.filter((p) => p.status === 'COMPLETED').length || 0,
          total: data.mediaMetadata?.pages?.length || data.pages.length,
        },
      };
    }

    // 3. If illustration job terminally FAILED
    if (data.illustrationStatus === 'FAILED') {
      throw new BadRequestException(
        'Illustration generation failed for this story. Please retry generating illustrations before exporting PDF.',
      );
    }

    if (data.pages.length === 0) {
      throw new NotFoundException('Story has no content');
    }

    const startTime = Date.now();
    try {
      const ownerId = data.userId || userId;
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
        ownerId,
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
  ): Promise<{ status: string; download_url: string | null; filename: string }> {
    const data = await this.getStoryData(storyId, userId);

    const safeTitle =
      data.title
        .replace(/[^a-zA-Z0-9\u0600-\u06FF\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'story';

    if (!data.audioUrl) {
      if (['PENDING', 'PROCESSING'].includes(data.audioStatus)) {
        return {
          status: data.audioStatus,
          download_url: null,
          filename: `${safeTitle}.mp3`,
        };
      }
      throw new NotFoundException('Audio narration not generated for this story');
    }

    return {
      status: 'COMPLETED',
      download_url: data.audioUrl,
      filename: `${safeTitle}.mp3`,
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

        const supabase = this.supabaseService.getUserClient();
      const bucket = this.configService.get<string>('EXPORTS_BUCKET', 'story-pdfs');
      const ownerId = data.userId || userId;
      const filePath = `${ownerId}/${storyId}/${Date.now()}-bundle.zip`;
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
