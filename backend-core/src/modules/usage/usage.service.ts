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
      const isUuid = (val?: string) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      const eventMetadata = { ...(metadata || {}) };
      let validResourceId: string | null = null;
      if (isUuid(resourceId)) {
        validResourceId = resourceId!;
      } else if (resourceId) {
        eventMetadata.resourceIdString = resourceId;
      }

      const client = this.supabase.getUserClient();
      const { error } = await client
        .from('usage_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          resource_id: validResourceId,
          metadata: eventMetadata,
        });

      if (error) {
        this.logger.warn(
          `Usage event tracking notice (${eventType}) for user ${userId}: ${error.message}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Usage event tracking exception (${eventType}) for user ${userId}`,
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
      .getClient()
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
