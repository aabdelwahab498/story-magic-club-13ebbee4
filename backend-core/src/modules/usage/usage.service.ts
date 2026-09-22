import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Tracks a usage event. Fire and forget to not block the main flow.
   */
  async trackUsage(
    userId: string,
    eventType: string,
    resourceId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .getAdminClient()
        .from('usage_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          resource_id: resourceId,
          metadata: metadata || {},
        });

      if (error) {
        this.logger.error(
          `Failed to track usage event ${eventType} for user ${userId}`,
          error,
        );
      }
    } catch (err) {
      this.logger.error(
        `Exception while tracking usage event ${eventType} for user ${userId}`,
        err,
      );
    }
  }

  /**
   * Gets a summary of tracked usage for a user.
   */
  async getUsageSummary(userId: string): Promise<{
    storiesCreated: number;
    illustrationsGenerated: number;
    pdfExports: number;
  }> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('usage_events')
      .select('event_type')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to fetch usage summary for user ${userId}`,
        error,
      );
      throw new Error('Failed to fetch usage summary');
    }

    const summary = {
      storiesCreated: 0,
      illustrationsGenerated: 0,
      pdfExports: 0,
    };

    if (data) {
      for (const event of data) {
        if (event.event_type === 'STORY_CREATED') summary.storiesCreated++;
        if (event.event_type === 'ILLUSTRATION_JOB_STARTED')
          summary.illustrationsGenerated++;
        if (event.event_type === 'PDF_EXPORTED') summary.pdfExports++;
      }
    }

    return summary;
  }
}
