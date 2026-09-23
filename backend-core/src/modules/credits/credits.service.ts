import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

/**
 * CreditsService manages platform-wide user credits (`illustration_credits`, `user_credits`, and `credit_transactions`).
 * Note: `illustration_credits` is canonical for illustration feature balances in Lovable Cloud.
 * User-owned operations use the caller JWT / user-scoped Supabase client under RLS.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Gets the current credit balance for a user.
   * Checks canonical `illustration_credits` table first; if missing, checks `user_credits` table.
   * Uses user-scoped Supabase client for authenticated context under RLS.
   * Returns 0 if no proven balance exists in either source.
   */
  async getBalance(userId: string): Promise<{ balance: number }> {
    const client = this.supabase.getUserClient();

    // 1. Query canonical illustration_credits table first
    const { data: icData, error: icError } = await client
      .from('illustration_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (icError) {
      this.logger.error(
        `Error querying canonical illustration_credits for user ${userId}: ${icError.message}`,
        icError,
      );
      throw new InternalServerErrorException('Failed to fetch credit balance');
    }

    if (icData !== null && typeof icData.balance === 'number') {
      return { balance: icData.balance };
    }

    // 2. Compatibility Fallback: Query user_credits table ONLY if illustration_credits row genuinely does not exist
    const { data, error } = await client
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Error fetching user_credits balance for user ${userId}: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException('Failed to fetch credit balance');
    }

    if (data !== null && typeof data.balance === 'number') {
      return { balance: data.balance };
    }

    return { balance: 0 };
  }

  /**
   * Consumes a specific amount of credits from a user's balance.
   * Uses user-scoped Supabase client for authenticated context under RLS.
   */
  async consumeCredits(
    userId: string,
    amount: number,
    type: string,
    referenceId?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException(
        'Amount to consume must be greater than zero',
      );
    }

    const client = this.supabase.getUserClient();

    if (referenceId) {
      const { data: existingTx, error: txCheckErr } = await client
        .from('credit_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('reference_id', referenceId)
        .eq('transaction_type', type)
        .maybeSingle();

      if (txCheckErr) {
        this.logger.warn(
          `Credit transaction idempotency check notice for user ${userId}: ${txCheckErr.message}`,
        );
      } else if (existingTx) {
        this.logger.warn(
          `[IDEMPOTENCY] Credits already consumed for user ${userId} and reference ${referenceId} (${type}), skipping duplicate debit.`,
        );
        return;
      }
    }

    const { balance } = await this.getBalance(userId);

    if (balance < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    // Check if canonical illustration_credits row exists for user
    const { data: icRecord, error: icCheckError } = await client
      .from('illustration_credits')
      .select('user_id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (icCheckError) {
      this.logger.error(
        `Error querying illustration_credits for user ${userId}: ${icCheckError.message}`,
        icCheckError,
      );
      throw new InternalServerErrorException('Failed to consume credits');
    }

    if (icRecord && typeof icRecord.balance === 'number') {
      const newIcBalance = Math.max(0, icRecord.balance - amount);
      const { error: icUpdateError } = await client
        .from('illustration_credits')
        .update({ balance: newIcBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (icUpdateError) {
        this.logger.error(
          `Error updating illustration_credits balance for user ${userId}: ${icUpdateError.message}`,
          icUpdateError,
        );
        throw new InternalServerErrorException('Failed to consume credits');
      }
    } else {
      // Fallback: update user_credits table
      const newBalance = Math.max(0, balance - amount);
      const { data: existingUserCred, error: ucCheckError } = await client
        .from('user_credits')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (ucCheckError) {
        this.logger.error(
          `Error querying user_credits for user ${userId}: ${ucCheckError.message}`,
          ucCheckError,
        );
        throw new InternalServerErrorException('Failed to consume credits');
      }

      let updateError;
      if (!existingUserCred) {
        const { error } = await client
          .from('user_credits')
          .insert({ user_id: userId, balance: newBalance });
        updateError = error;
      } else {
        const { error } = await client
          .from('user_credits')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        updateError = error;
      }

      if (updateError) {
        this.logger.error(
          `Error updating balance for user ${userId}: ${updateError.message}`,
          updateError,
        );
        throw new InternalServerErrorException('Failed to consume credits');
      }
    }

    // Insert transaction
    const { error: txError } = await client
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        transaction_type: type,
        reference_id: referenceId,
      });

    if (txError) {
      this.logger.warn(
        `Credit transaction recording notice for user ${userId} (${txError.message}); balance update succeeded.`,
      );
    }
  }

  /**
   * Adds credits to a user's balance.
   * Uses user-scoped Supabase client for authenticated context under RLS.
   */
  async addCredits(
    userId: string,
    amount: number,
    type: string,
    description?: string,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Amount to add must be greater than zero');
    }

    const client = this.supabase.getUserClient();

    const { balance } = await this.getBalance(userId);
    const newBalance = balance + amount;

    // Check canonical illustration_credits table first
    const { data: icRecord, error: icCheckError } = await client
      .from('illustration_credits')
      .select('user_id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (!icCheckError && icRecord && typeof icRecord.balance === 'number') {
      const { error: icUpdateError } = await client
        .from('illustration_credits')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (icUpdateError) {
        this.logger.error(
          `Error adding illustration_credits for user ${userId}: ${icUpdateError.message}`,
          icUpdateError,
        );
        throw new InternalServerErrorException('Failed to add credits');
      }
    } else {
      let updateError;
      const { data } = await client
        .from('user_credits')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) {
        const { error } = await client
          .from('user_credits')
          .insert({ user_id: userId, balance: newBalance });
        updateError = error;
      } else {
        const { error } = await client
          .from('user_credits')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        updateError = error;
      }

      if (updateError) {
        this.logger.error(
          `Error adding credits for user ${userId}: ${updateError.message}`,
          updateError,
        );
        throw new InternalServerErrorException('Failed to add credits');
      }
    }

    const { error: txError } = await client
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        transaction_type: type,
        description: description,
      });

    if (txError) {
      this.logger.error(
        `Error recording credit transaction for user ${userId}: ${txError.message}`,
        txError,
      );
    }
  }
}
