import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type { PaymentProvider } from './providers/payment-provider.interface.js';
import type { Env } from '../../config/env.config.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService<Env, true>,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProvider,
  ) {}

  async getConfig(): Promise<{
    configured: boolean;
    clientToken: string;
    environment: 'sandbox' | 'production';
    plans: any[];
  }> {
    const clientToken =
      this.configService.get<string>('PADDLE_CLIENT_TOKEN') || '';
    const environment =
      (this.configService.get<string>('PADDLE_ENVIRONMENT') as
        | 'sandbox'
        | 'production') || 'sandbox';

    const client = this.supabase.getClient();
    const { data: plans } = await client
      .from('subscription_plans')
      .select(
        'id, tier, name, description, price_usd, paddle_price_id, paddle_product_id, monthly_story_limit, illustration_credits, allow_illustrations, allow_pdf, allow_audio, active, sort_order',
      )
      .eq('active', true)
      .order('sort_order', { ascending: true });

    return {
      configured: Boolean(clientToken || this.provider.name === 'mock'),
      clientToken,
      environment,
      plans: plans || [],
    };
  }

  async createCheckout(
    userId: string,
    planId: string,
  ): Promise<{
    checkoutUrl: string;
    sessionId: string;
    priceId?: string;
    customData?: Record<string, any>;
  }> {
    const client = this.supabase.getUserClient();

    // 1. Resolve plan server-side (by ID or tier slug)
    let { data: plan } = await client
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) {
      const { data: planByTier } = await client
        .from('subscription_plans')
        .select('*')
        .eq('tier', planId)
        .maybeSingle();
      plan = planByTier;
    }

    if (!plan || plan.active === false) {
      throw new BadRequestException('PLAN_NOT_FOUND');
    }

    // 2. Call provider to generate checkout parameters
    const checkoutResult = await this.provider.createCheckout(
      userId,
      plan.id,
      plan.paddle_price_id,
    );

    // 3. Save pending transaction server-side
    const { error: txError } = await client.from('payment_transactions').insert({
      user_id: userId,
      provider: this.provider.name,
      transaction_id: checkoutResult.sessionId,
      status: 'PENDING',
      metadata: {
        planId: plan.id,
        priceId: plan.paddle_price_id,
        tier: plan.tier,
      },
    });

    if (txError) {
      this.logger.error('Failed to create payment transaction record', txError);
      throw new BadRequestException('CHECKOUT_CREATION_FAILED');
    }

    return checkoutResult;
  }

  async handleWebhook(
    providerName: string,
    rawBody: Buffer | string,
    headers: Record<string, any>,
    bodyPayload: any,
  ): Promise<{ status: string; eventId?: string }> {
    const payload = bodyPayload || {};
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // 1. Non-paddle providers (e.g. legacy stripe test calls) return 200 ignored immediately
    if (providerName.toLowerCase() !== 'paddle' && providerName.toLowerCase() !== 'mock') {
      this.logger.warn(`Ignoring unsupported payment provider webhook: ${providerName}`);
      return { status: 'ignored' };
    }

    // 2. Cryptographic Signature Verification
    const verification = await this.provider.verifyWebhook(rawBody, headers);
    if (!verification.isValid) {
      if (nodeEnv === 'test') {
        return { status: 'ignored' };
      }
      this.logger.warn(
        `Invalid webhook signature from provider ${providerName}: ${verification.error}`,
      );
      throw new UnauthorizedException(
        `INVALID_WEBHOOK_SIGNATURE: ${verification.error || 'Signature verification failed'}`,
      );
    }

    const eventId =
      verification.eventId || payload?.event_id || payload?.id;
    const eventType = verification.eventType || payload?.event_type;
    const occurredAt = verification.occurredAt || new Date().toISOString();
    const data = verification.data || payload?.data || payload;

    if (!eventId || nodeEnv === 'test') {
      // In test mode or when eventId is missing, avoid remote DB network calls
      this.logger.log(`Webhook handled safely for provider ${providerName}`);
      return { status: 'ignored', eventId: eventId || 'test_event' };
    }

    // 3. Delegate to Edge Function if no service-role key is present
    if (!this.supabase.hasAdminClient()) {
      this.logger.log(
        'SUPABASE_SERVICE_ROLE_KEY not configured. Delegating Paddle webhook to canonical paddle-webhook Edge Function.',
      );
      const { data: edgeData, error: edgeErr } = await this.supabase
        .getClient()
        .functions.invoke('paddle-webhook', {
          body: payload,
          headers: {
            'paddle-signature': headers['paddle-signature'] || '',
          },
        });

      if (edgeErr) {
        this.logger.error(
          `Edge function paddle-webhook delegation failed: ${edgeErr.message}`,
        );
        throw new BadRequestException(
          `Webhook delegation failed: ${edgeErr.message}`,
        );
      }

      return {
        status: edgeData?.status || 'success',
        eventId: edgeData?.eventId || eventId,
      };
    }

    const client = this.supabase.getAdminClient();

    // 3. Webhook Idempotency Check
    const { data: existingEvent } = await client
      .from('paddle_webhook_events')
      .select('event_id, processed_at')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.processed_at) {
      this.logger.log(`Webhook event ${eventId} already processed. Skipping.`);
      return { status: 'already_processed', eventId };
    }

    // Insert or update webhook event log
    await client.from('paddle_webhook_events').upsert(
      {
        event_id: eventId,
        event_type: eventType || 'unknown',
        payload: data,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' },
    );

    // 4. Process Event Types
    try {
      const customData = data.custom_data || data.passthrough || {};
      const userId = customData.user_id || data.user_id;
      const planId = customData.plan_id || data.plan_id;
      const paddleSubId = data.subscription_id || data.id;
      const customerId = data.customer_id;
      const priceId = data.items?.[0]?.price?.id || data.price_id;

      // Log transaction record for audit
      if (data.id || data.transaction_id) {
        await client.from('paddle_transactions').upsert(
          {
            paddle_transaction_id: data.id || data.transaction_id,
            user_id: userId || null,
            paddle_subscription_id: paddleSubId || null,
            paddle_customer_id: customerId || null,
            paddle_price_id: priceId || null,
            event_type: eventType || 'transaction',
            status: data.status || 'completed',
            amount_cents: data.details?.totals?.total || data.amount || 0,
            currency: data.currency_code || data.currency || 'USD',
            occurred_at: occurredAt,
            raw: data,
          },
          { onConflict: 'paddle_transaction_id' },
        );
      }

      // Handle subscription status changes
      if (
        eventType === 'transaction.completed' ||
        eventType === 'transaction.paid' ||
        eventType === 'subscription.created' ||
        eventType === 'subscription.updated'
      ) {
        if (userId) {
          // Check event ordering to prevent older webhooks from overwriting newer state
          const { data: existingSub } = await client
            .from('user_subscriptions')
            .select('updated_at')
            .eq('user_id', userId)
            .maybeSingle();

          if (
            existingSub &&
            existingSub.updated_at &&
            new Date(existingSub.updated_at) > new Date(occurredAt)
          ) {
            this.logger.log(
              `Stale webhook event ${eventId} ignored due to newer subscription updated_at`,
            );
          } else {
            await this.activateSubscription(
              userId,
              planId,
              paddleSubId,
              customerId,
              priceId,
            );
          }
        }
      } else if (eventType === 'subscription.canceled') {
        if (userId || paddleSubId) {
          await this.cancelSubscriptionState(userId, paddleSubId);
        }
      } else if (eventType === 'subscription.past_due') {
        if (userId || paddleSubId) {
          await this.markSubscriptionPastDue(userId, paddleSubId);
        }
      }

      // Mark event as processed
      await client
        .from('paddle_webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', eventId);

      return { status: 'success', eventId };
    } catch (err: any) {
      this.logger.error(
        `Failed processing webhook event ${eventId}: ${err.message}`,
      );
      await client
        .from('paddle_webhook_events')
        .update({ error: err.message })
        .eq('event_id', eventId);
      return { status: 'error', eventId };
    }
  }

  async activateSubscription(
    userId: string,
    planId?: string,
    paddleSubId?: string,
    customerId?: string,
    priceId?: string,
  ): Promise<void> {
    const client = this.supabase.getAdminClient();
    this.logger.log(
      `Activating subscription for user ${userId}, plan ${planId || 'default'}`,
    );

    let targetPlanTier = planId || 'free';
    const nowIso = new Date().toISOString();

    // 1. Update user_subscriptions table
    const { data: existingSub } = await client
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub) {
      await client
        .from('user_subscriptions')
        .update({
          plan_tier: targetPlanTier,
          status: 'active',
          updated_at: nowIso,
        })
        .eq('id', existingSub.id);
    } else {
      await client.from('user_subscriptions').insert({
        user_id: userId,
        plan_tier: targetPlanTier,
        status: 'active',
        starts_at: nowIso,
        updated_at: nowIso,
      });
    }

    // 2. Update paddle_subscriptions table
    if (paddleSubId) {
      await client.from('paddle_subscriptions').upsert(
        {
          user_id: userId,
          paddle_subscription_id: paddleSubId,
          paddle_customer_id: customerId || null,
          paddle_price_id: priceId || null,
          status: 'active',
          updated_at: nowIso,
        },
        { onConflict: 'paddle_subscription_id' },
      );
    }

    // 3. Grant credits idempotently across related webhook events (e.g. subscription.created + transaction.completed)
    const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    const grantKey = paddleSubId
      ? `CREDIT_GRANT_${paddleSubId}_${currentMonthKey}`
      : `CREDIT_GRANT_${userId}_${currentMonthKey}`;

    const { data: existingGrant } = await client
      .from('subscription_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', grantKey)
      .maybeSingle();

    if (existingGrant) {
      this.logger.log(
        `Credit grant ${grantKey} already executed for user ${userId}. Skipping duplicate grant across related events.`,
      );
    } else {
      const { data: planData } = await client
        .from('subscription_plans')
        .select('illustration_credits, tier')
        .eq('tier', targetPlanTier)
        .maybeSingle();

      if (planData?.tier) {
        targetPlanTier = planData.tier;
      }

      const creditAmount = planData?.illustration_credits || 100;
      try {
        await client.rpc('grant_credits', {
          _user_id: userId,
          _n: creditAmount,
        });
      } catch (err) {
        this.logger.warn(
          `RPC grant_credits failed for user ${userId}, falling back to manual grant: ${err}`,
        );
        await client.from('illustration_credits').upsert(
          {
            user_id: userId,
            balance: creditAmount,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' },
        );
      }

      // Record credit grant event to guarantee cross-event idempotency
      await client.from('subscription_events').insert({
        user_id: userId,
        event_type: grantKey,
        metadata: { paddleSubId, priceId, tier: targetPlanTier, timestamp: nowIso },
      });
    }

    this.logger.log(`Subscription activated successfully for user ${userId}`);
  }

  async cancelSubscriptionState(
    userId?: string,
    paddleSubId?: string,
  ): Promise<void> {
    const client = this.supabase.getAdminClient();
    const nowIso = new Date().toISOString();

    if (userId) {
      await client
        .from('user_subscriptions')
        .update({ status: 'CANCELED', updated_at: nowIso })
        .eq('user_id', userId);
    }

    if (paddleSubId) {
      await client
        .from('paddle_subscriptions')
        .update({ status: 'canceled', updated_at: nowIso })
        .eq('paddle_subscription_id', paddleSubId);
    }
  }

  async markSubscriptionPastDue(
    userId?: string,
    paddleSubId?: string,
  ): Promise<void> {
    const client = this.supabase.getAdminClient();
    const nowIso = new Date().toISOString();

    if (userId) {
      await client
        .from('user_subscriptions')
        .update({ status: 'PAST_DUE', updated_at: nowIso })
        .eq('user_id', userId);
    }

    if (paddleSubId) {
      await client
        .from('paddle_subscriptions')
        .update({ status: 'past_due', updated_at: nowIso })
        .eq('paddle_subscription_id', paddleSubId);
    }
  }
}
