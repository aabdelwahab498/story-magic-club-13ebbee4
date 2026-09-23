import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getDashboardOverview() {
    const supabase = this.supabaseService.getAdminClient();

    // In a real scenario you would optimize these queries using counts and aggregates
    // For this prototype we will do count queries where possible
    const [
      { count: totalUsers },
      { count: newUsersThisMonth },
      { count: freeSubscriptions },
      { count: premiumSubscriptions },
      { data: payments },
      { count: storiesGenerated },
      { count: illustrationsGenerated },
      { count: pdfExports },
      { data: aiCosts }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).eq('plan_tier', 'free'),
      supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).neq('plan_tier', 'free').ilike('status', 'active'),
      supabase.from('payment_transactions').select('amount').eq('status', 'SUCCESS').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'story_generation'),
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'illustration_generation'),
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'pdf_export'),
      supabase.from('ai_usage_costs').select('estimated_cost')
    ]);

    const monthlyRevenue = (payments || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalAiCost = (aiCosts || []).reduce((acc, curr) => acc + (Number(curr.estimated_cost) || 0), 0);

    return {
      users: {
        total: totalUsers || 0,
        newThisMonth: newUsersThisMonth || 0,
      },
      subscriptions: {
        free: freeSubscriptions || 0,
        premium: premiumSubscriptions || 0,
      },
      revenue: {
        monthly: monthlyRevenue,
      },
      usage: {
        stories: storiesGenerated || 0,
        illustrations: illustrationsGenerated || 0,
        pdfExports: pdfExports || 0,
      },
      costs: {
        totalAiCost,
      }
    };
  }

  async getUsersAnalytics() {
    const supabase = this.supabaseService.getAdminClient();
    
    const isProduction = process.env.NODE_ENV === 'production';
    const supabaseUrl = process.env.SUPABASE_URL || '';
    if (!isProduction && supabaseUrl.includes('example.supabase.co')) {
      return { total: 0, users: [] };
    }

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, role');

    if (error) {
      this.logger.error(`Error fetching users: ${error.message}`);
      throw new Error('Failed to fetch users');
    }

    return {
      total: users?.length || 0,
      users: users || [],
    };
  }

  async getSubscriptionsAnalytics() {
    const supabase = this.supabaseService.getAdminClient();

    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, plan_id, status, current_period_end, created_at');
    
    if (error) {
      this.logger.error(`Error fetching subscriptions: ${error.message}`);
      throw new Error('Failed to fetch subscriptions');
    }

    const active = subscriptions?.filter(s => s.status === 'ACTIVE').length || 0;
    const cancelled = subscriptions?.filter(s => s.status === 'CANCELLED').length || 0;

    return {
      active,
      cancelled,
      total: subscriptions?.length || 0,
      subscriptions: subscriptions || [],
    };
  }

  async getAiUsageAnalytics() {
    const supabase = this.supabaseService.getAdminClient();

    const [
      { count: stories },
      { count: illustrations },
      { count: pdfExports },
      { data: creditTransactions }
    ] = await Promise.all([
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'story_generation'),
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'illustration_generation'),
      supabase.from('usage_events').select('*', { count: 'exact', head: true }).eq('feature_slug', 'pdf_export'),
      supabase.from('credit_transactions').select('amount').eq('type', 'USAGE')
    ]);

    const creditsConsumed = (creditTransactions || []).reduce((acc, curr) => acc + Math.abs(curr.amount || 0), 0);

    return {
      storiesGenerated: stories || 0,
      illustrationsGenerated: illustrations || 0,
      pdfExports: pdfExports || 0,
      creditsConsumed,
    };
  }
}
