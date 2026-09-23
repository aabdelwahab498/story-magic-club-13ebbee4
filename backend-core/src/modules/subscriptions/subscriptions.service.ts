import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';

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

export interface StoryQuotaResult {
  allowed: boolean;
  tier: string;
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
  reason: string | null;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Retrieves the current user's subscription plan, status, features, and limits
  /**
   * Helper returning canonical default subscription for free tier users
   * or users whose paid subscription expired/reverted to free tier.
   */
  private getFreeTierSubscription(): UserSubscription {
    return {
      plan: 'free',
      status: 'ACTIVE',
      features: [
        'STORY_GENERATION',
        'ILLUSTRATION_GENERATION',
        'REGENERATE_ILLUSTRATION',
        'PDF_EXPORT',
        'AUDIO_NARRATION',
      ],
      limits: {
        STORIES_PER_MONTH: 30,
        STORIES_PER_DAY: 3,
        ILLUSTRATIONS_PER_MONTH: 20,
      },
    };
  }

  /**
   * Retrieves the current user's subscription plan, status, features, and limits
   * based on the canonical Lovable Cloud schema (`user_subscriptions` and `subscription_plans`).
   */
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    const client = this.supabase.getUserClient();
    const startTime = Date.now();

    try {
      const { data: subRows, error: subError } = await client
        .from('user_subscriptions')
        .select('id, user_id, plan_tier, status, starts_at, expires_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const subData = subRows && subRows.length > 0 ? subRows[0] : null;

      if (subError) {
        this.logger.warn(
          `Database warning fetching user_subscriptions for ${userId}: ${subError.message}`,
        );
      }

      // Missing subscription -> default canonical Free Tier
      if (!subData) {
        this.logger.log(`User ${userId} has no explicit subscription record. Assigning canonical free tier.`);
        return this.getFreeTierSubscription();
      }

      const rawTier = subData.plan_tier || 'free';
      const planTier = String(rawTier).toLowerCase();
      const statusRaw = subData.status ? String(subData.status).toLowerCase() : 'active';
      const now = new Date();
      const isExpired = subData.expires_at
        ? new Date(subData.expires_at) <= now
        : false;

      const isActive =
        (statusRaw === 'active' ||
          statusRaw === 'trialing' ||
          statusRaw === 'active_trial' ||
          statusRaw === 'free' ||
          statusRaw === '') &&
        !isExpired;

      // Inactive or expired subscription
      if (!isActive) {
        if (planTier === 'free') {
          return this.getFreeTierSubscription();
        }
        this.logger.log(
          `User ${userId} subscription (${planTier}) is inactive/expired (status: ${statusRaw}). Reverting to free tier.`,
        );
        return this.getFreeTierSubscription();
      }

      // Active subscription — fetch plan settings from canonical subscription_plans
      const { data: planData } = await client
        .from('subscription_plans')
        .select(`
          id,
          tier,
          name,
          description,
          price_usd,
          price_egp,
          monthly_story_limit,
          daily_story_limit,
          allow_illustrations,
          allow_pdf,
          allow_audio,
          illustration_credits,
          features,
          active,
          sort_order
        `)
        .eq('tier', planTier)
        .eq('active', true)
        .maybeSingle();

      const features: string[] = ['STORY_GENERATION'];

      if (planData) {
        if (
          planData.allow_illustrations !== false ||
          (planData.illustration_credits && planData.illustration_credits > 0)
        ) {
          features.push('ILLUSTRATION_GENERATION', 'REGENERATE_ILLUSTRATION');
        }
        if (planData.allow_pdf !== false) {
          features.push('PDF_EXPORT');
        }
        if (planData.allow_audio !== false) {
          features.push('AUDIO_NARRATION');
        }
        if (Array.isArray(planData.features)) {
          for (const item of planData.features) {
            if (typeof item === 'string' && !features.includes(item)) {
              features.push(item);
            } else if (
              item &&
              typeof item === 'object' &&
              item.feature_key &&
              !features.includes(item.feature_key)
            ) {
              features.push(item.feature_key);
            }
          }
        }
      } else {
        // Canonical defaults if plan row is unpopulated
        features.push(
          'ILLUSTRATION_GENERATION',
          'REGENERATE_ILLUSTRATION',
          'PDF_EXPORT',
          'AUDIO_NARRATION',
        );
      }

      const limits: Record<string, number | null> = {
        STORIES_PER_MONTH: planData?.monthly_story_limit ?? (planTier === 'free' ? 30 : null),
        STORIES_PER_DAY: planData?.daily_story_limit ?? (planTier === 'free' ? 3 : null),
        ILLUSTRATIONS_PER_MONTH: planData?.illustration_credits ?? (planTier === 'free' ? 20 : null),
      };

      return {
        plan: planTier,
        status: 'ACTIVE',
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
   * Checks story generation quota for a user. Reuses the canonical check_story_quota RPC
   * when available, falling back to local query logic against ai_story_history & plan limits.
   */
  async checkStoryQuota(
    userId: string,
    userContext?: UserContext,
  ): Promise<StoryQuotaResult> {
    if (userContext) {
      const roles = userContext.roles || (userContext.role ? [userContext.role] : []);
      const isAdmin =
        roles.includes(Role.ADMIN) ||
        roles.includes(Role.SUPER_ADMIN) ||
        roles.includes('admin' as Role) ||
        roles.includes('super_admin' as Role);
      if (isAdmin) {
        return {
          allowed: true,
          tier: 'admin',
          daily_used: 0,
          daily_limit: 999999,
          monthly_used: 0,
          monthly_limit: 999999,
          reason: null,
        };
      }
    }

    const client = this.supabase.getUserClient();
    const startTime = Date.now();

    try {
      const { data, error } = await client.rpc('check_story_quota', {
        _user_id: userId,
      });

      if (!error && data && typeof data === 'object') {
        return {
          allowed: Boolean(data.allowed),
          tier: data.tier || 'free',
          daily_used: Number(data.daily_used ?? 0),
          daily_limit: Number(data.daily_limit ?? 3),
          monthly_used: Number(data.monthly_used ?? 0),
          monthly_limit: Number(data.monthly_limit ?? 30),
          reason: data.reason || null,
        };
      }
    } catch (e: any) {
      this.logger.warn(`RPC check_story_quota failed: ${e.message}`);
    } finally {
      this.metricsService.observeDatabaseQueryDuration(
        (Date.now() - startTime) / 1000,
      );
    }

    return this.checkStoryQuotaFallback(userId);
  }

  /**
   * Fallback story quota calculation if RPC execution fails or is mocked out.
   */
  async checkStoryQuotaFallback(userId: string): Promise<StoryQuotaResult> {
    const sub = await this.getUserSubscription(userId);

    if (sub.status !== 'ACTIVE') {
      return {
        allowed: false,
        tier: sub.plan,
        daily_used: 0,
        daily_limit: 0,
        monthly_used: 0,
        monthly_limit: 0,
        reason: 'subscription_inactive',
      };
    }

    const dailyLimit = sub.limits['STORIES_PER_DAY'] ?? 3;
    const monthlyLimit = sub.limits['STORIES_PER_MONTH'] ?? 30;

    const dailyUsed = await this.getDailyStoryCount(userId);
    const monthlyUsed = await this.getMonthlyUsage(userId, 'STORY_CREATED');

    let reason: string | null = null;
    let allowed = true;

    if (dailyLimit !== null && dailyUsed >= dailyLimit) {
      allowed = false;
      reason = 'daily_limit_reached';
    } else if (monthlyLimit !== null && monthlyUsed >= monthlyLimit) {
      allowed = false;
      reason = 'monthly_limit_reached';
    }

    return {
      allowed,
      tier: sub.plan,
      daily_used: dailyUsed,
      daily_limit: dailyLimit ?? 0,
      monthly_used: monthlyUsed,
      monthly_limit: monthlyLimit ?? 0,
      reason,
    };
  }

  private async getDailyStoryCount(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const client = this.supabase.getUserClient();
    try {
      const { count: historyCount } = await client
        .from('ai_story_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString());

      if (historyCount !== null && historyCount !== undefined) {
        return historyCount;
      }
    } catch {
      // ignore
    }

    try {
      const { count: usageCount } = await client
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_type', 'STORY_CREATED')
        .gte('created_at', startOfDay.toISOString());

      return usageCount || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Gets all active plans with their features and limits from canonical subscription_plans.
   */
  async getActivePlans(): Promise<any[]> {
    const client = this.supabase.getUserClient();
    const startTime = Date.now();
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const supabaseUrl = process.env.SUPABASE_URL || '';
      if (!isProduction && supabaseUrl.includes('example.supabase.co')) {
        return [
          {
            id: 'plan-free',
            name: 'Free',
            slug: 'free',
            tier: 'free',
            description: 'Free Plan',
            price_usd: 0,
            price_egp: 0,
            is_featured: false,
            features: ['STORY_GENERATION'],
            limits: { STORIES_PER_MONTH: 30, STORIES_PER_DAY: 3 },
          },
        ];
      }

      const { data: plans, error } = await client
        .from('subscription_plans')
        .select(`
          id, 
          tier,
          name, 
          description, 
          price_usd, 
          price_egp, 
          monthly_story_limit,
          daily_story_limit,
          allow_illustrations,
          allow_pdf,
          allow_audio,
          illustration_credits,
          active,
          sort_order
        `)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error || !plans) {
        this.logger.error('Failed to fetch active plans', error);
        return [];
      }

      return plans.map((p: any) => {
        const features: string[] = ['STORY_GENERATION'];
        if (
          p.allow_illustrations ||
          (p.illustration_credits && p.illustration_credits > 0)
        ) {
          features.push('ILLUSTRATION_GENERATION');
        }
        if (p.allow_pdf) features.push('PDF_EXPORT');
        if (p.allow_audio) features.push('AUDIO_NARRATION');

        return {
          id: p.id,
          name: p.name,
          slug: p.tier,
          tier: p.tier,
          description: p.description,
          price_usd: p.price_usd,
          price_egp: p.price_egp,
          is_featured: false,
          features,
          limits: {
            STORIES_PER_MONTH: p.monthly_story_limit ?? null,
            STORIES_PER_DAY: p.daily_story_limit ?? null,
            ILLUSTRATIONS_PER_MONTH: p.illustration_credits ?? null,
          },
        };
      });
    } catch (e: any) {
      this.logger.warn(
        `Could not fetch active plans from database: ${e.message}`,
      );
      return [];
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

    const client = this.supabase.getUserClient();
    const startTime = Date.now();

    try {
      if (eventType === 'STORY_CREATED') {
        const { count: historyCount } = await client
          .from('ai_story_history')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfMonth.toISOString());

        if (
          historyCount !== null &&
          historyCount !== undefined &&
          historyCount > 0
        ) {
          return historyCount;
        }
      }

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

    if (sub.status !== 'ACTIVE') {
      return { allowed: false, current: 0, limit: 0 };
    }

    const limit = sub.limits[limitKey];

    if (limit === null || limit === undefined) {
      return { allowed: true, current: 0, limit: null };
    }

    let currentUsage = 0;
    if (limitKey === 'STORIES_PER_MONTH') {
      currentUsage = await this.getMonthlyUsage(userId, 'STORY_CREATED');
    } else if (limitKey === 'STORIES_PER_DAY') {
      currentUsage = await this.getDailyStoryCount(userId);
    } else if (limitKey === 'ILLUSTRATIONS_PER_MONTH') {
      currentUsage = await this.getMonthlyUsage(
        userId,
        'ILLUSTRATION_JOB_STARTED',
      );
    } else if (limitKey === 'PDF_EXPORTS_PER_MONTH') {
      currentUsage = await this.getMonthlyUsage(userId, 'PDF_EXPORTED');
    } else {
      this.logger.warn(`Unknown limitKey ${limitKey} for tracking usage.`);
      return { allowed: true, current: 0, limit: limit };
    }

    return {
      allowed: currentUsage < limit,
      current: currentUsage,
      limit: limit,
    };
  }
}

