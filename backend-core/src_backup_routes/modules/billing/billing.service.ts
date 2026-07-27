import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type { PaymentProvider } from './providers/payment-provider.interface.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProvider
  ) {}

  async createCheckout(userId: string, planId: string): Promise<{ checkoutUrl: string, sessionId: string }> {
    const client = this.supabase.getAdminClient();

    // Verify plan exists
    const { data: plan, error: planError } = await client
      .from('subscription_plans')
      .select('id, slug')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new BadRequestException('Invalid plan ID');
    }

    // Call provider
    const { checkoutUrl, sessionId } = await this.provider.createCheckout(userId, planId);

    // Save transaction
    const { error: txError } = await client
      .from('payment_transactions')
      .insert({
        user_id: userId,
        provider: 'mock', // Should be dynamic based on provider
        transaction_id: sessionId,
        status: 'PENDING',
        metadata: { planId }
      });

    if (txError) {
      this.logger.error('Failed to create payment transaction', txError);
      throw new Error('Failed to create payment transaction');
    }

    return { checkoutUrl, sessionId };
  }

  async handleWebhook(providerName: string, payload: any): Promise<boolean> {
    // 1. Verify via provider
    const isValid = await this.provider.handleWebhook(payload);
    if (!isValid) {
      this.logger.warn(`Invalid webhook from provider ${providerName}`);
      return false;
    }

    // In a real scenario, the payload contains the transaction ID or customer ID.
    // Since this is a mock, let's assume the payload contains { transactionId: '...', userId: '...', planId: '...' }
    // Or we extract it based on provider.
    const transactionId = payload.transactionId;
    if (!transactionId) {
      this.logger.warn('No transactionId in webhook payload');
      return false;
    }

    const client = this.supabase.getAdminClient();

    // 2. Update transaction status
    const { data: tx, error: txError } = await client
      .from('payment_transactions')
      .update({ status: 'SUCCESS' })
      .eq('transaction_id', transactionId)
      .select()
      .single();

    if (txError || !tx) {
      this.logger.error('Failed to update transaction status', txError);
      return false;
    }

    const userId = tx.user_id;
    const planId = tx.metadata?.planId;

    if (!planId) {
      this.logger.error('Transaction missing planId in metadata');
      return false;
    }

    // 3. Activate subscription
    await this.activateSubscription(userId, planId);

    return true;
  }

  async activateSubscription(userId: string, planId: string): Promise<void> {
    const client = this.supabase.getAdminClient();
    this.logger.log(`Activating subscription for user ${userId}, plan ${planId}`);

    // Update or insert into user_subscriptions
    // First check if one exists
    const { data: existingSub } = await client
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .single();

    if (existingSub) {
      await client
        .from('user_subscriptions')
        .update({
          plan_id: planId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id);
    } else {
      await client
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'ACTIVE',
          starts_at: new Date().toISOString()
        });
    }

    // Create subscription event
    await client
      .from('subscription_events')
      .insert({
        user_id: userId,
        event_type: 'SUBSCRIPTION_ACTIVATED',
        plan_id: planId,
        metadata: { timestamp: new Date().toISOString() }
      });
      
    this.logger.log(`Subscription activated successfully for user ${userId}`);
  }
}
