import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

export interface UserSubscription {
  plan: string;
  status: string;
  features: string[];
  limits: Record<string, number | null>;
}

export interface FeatureAccessResult {
  allowed: boolean;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Retrieves the current user's subscription plan, status, and enabled features.
   * Optimizes 3 database queries into a single database JOIN query.
   */
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    const client = this.supabase.getAdminClient();
    const startTime = Date.now();

    try {
      const { data: subData, error: subError } = await client
        .from('user_subscriptions')
        .select(`
          status,
          plan_id,
          subscription_plans (
            slug,
            plan_features ( feature_key, enabled ),
            plan_limits ( limit_key, limit_value )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      let planSlug = 'FREE';
      let status = 'ACTIVE';
      const features: string[] = [];
      const limits: Record<string, number | null> = {};

      if (subError || !subData) {
        this.logger.warn(
          `User ${userId} has no active subscription. Defaulting to FREE.`,
        );
        // Fetch FREE plan details
        const { data: freePlan } = await client
          .from('subscription_plans')
          .select(`
            id,
            slug,
            plan_features ( feature_key, enabled ),
            plan_limits ( limit_key, limit_value )
          `)
          .eq('slug', 'FREE')
          .single();

        if (freePlan) {
          planSlug = 'FREE';
          freePlan.plan_features
            ?.filter((f: any) => f.enabled)
            .forEach((f: any) => features.push(f.feature_key));
          freePlan.plan_limits?.forEach((l: any) => {
            limits[l.limit_key] = l.limit_value;
          });
        }
      } else {
        const plan = subData.subscription_plans as any;
        planSlug = plan?.slug || 'FREE';
        status = subData.status;
        plan?.plan_features
          ?.filter((f: any) => f.enabled)
          .forEach((f: any) => features.push(f.feature_key));
        plan?.plan_limits?.forEach((l: any) => {
          limits[l.limit_key] = l.limit_value;
        });
      }

      return {
        plan: planSlug,
        status,
        features,
        limits,
      };
    } finally {
      this.metricsService.observeDatabaseQueryDuration(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  /**
   * Gets all active plans with their features and limits.
   */
  async getActivePlans(): Promise<any[]> {
    const client = this.supabase.getAdminClient();
    const startTime = Date.now();
    try {
      const { data: plans, error } = await client
        .from('subscription_plans')
        .select(`
          id, 
          name, 
          slug, 
          description, 
          price_usd, 
          price_egp, 
          is_featured,
          plan_features ( feature_key, enabled ),
          plan_limits ( limit_key, limit_value )
        `)
        .eq('active', true)
        .order('sort_order');
        
      if (error || !plans) {
        this.logger.error('Failed to fetch active plans', error);
        return [];
      }

      return plans.map((p: any) => {
        const features = p.plan_features
          ?.filter((f: any) => f.enabled)
          .map((f: any) => f.feature_key) || [];
          
        const limits: Record<string, number | null> = {};
        p.plan_limits?.forEach((l: any) => {
          limits[l.limit_key] = l.limit_value;
        });

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price_usd: p.price_usd,
          price_egp: p.price_egp,
          is_featured: p.is_featured,
          features,
          limits,
        };
      });
    } finally {
      this.metricsService.observeDatabaseQueryDuration(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  /**
   * Returns feature comparison data suitable for pricing page.
   */
  async comparePlans(): Promise<any[]> {
    return this.getActivePlans();
  }

  /**
   * Checks if a user has access to a specific feature.
   */
  async canAccessFeature(
    userId: string,
    featureKey: string,
  ): Promise<FeatureAccessResult> {
    const sub = await this.getUserSubscription(userId);
    return {
      allowed: sub.features.includes(featureKey),
    };
  }

  /**
   * Fetch current month's usage count for a specific usage event.
   */
  async getMonthlyUsage(userId: string, eventType: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const client = this.supabase.getAdminClient();
    const startTime = Date.now();

    try {
      const { count } = await client
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_type', eventType)
        .gte('created_at', startOfMonth.toISOString());

      return count || 0;
    } finally {
      this.metricsService.observeDatabaseQueryDuration(
        (Date.now() - startTime) / 1000,
      );
    }
  }

  /**
   * Checks if a user is within the limit for a specific key.
   */
  async checkLimit(
    userId: string,
    limitKey: string,
  ): Promise<LimitCheckResult> {
    const sub = await this.getUserSubscription(userId);
    const limit = sub.limits[limitKey];

    if (limit === null || limit === undefined) {
      return { allowed: true, current: 0, limit: null };
    }

    let eventType = '';
    if (limitKey === 'STORIES_PER_MONTH') eventType = 'STORY_CREATED';
    else if (limitKey === 'ILLUSTRATIONS_PER_MONTH')
      eventType = 'ILLUSTRATION_JOB_STARTED';
    else if (limitKey === 'PDF_EXPORTS_PER_MONTH') eventType = 'PDF_EXPORTED';

    if (!eventType) {
      this.logger.warn(`Unknown limitKey ${limitKey} for tracking usage.`);
      return { allowed: true, current: 0, limit: limit };
    }

    const currentUsage = await this.getMonthlyUsage(userId, eventType);

    return {
      allowed: currentUsage < limit,
      current: currentUsage,
      limit: limit,
    };
  }
}
