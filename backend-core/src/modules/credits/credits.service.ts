import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Gets the current credit balance for a user.
   */
  async getBalance(userId: string): Promise<{ balance: number }> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error fetching balance for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to fetch credit balance');
    }

    if (!data) {
      // Return 0 if no record exists yet.
      return { balance: 0 };
    }

    return { balance: data.balance };
  }

  /**
   * Consumes a specific amount of credits from a user's balance.
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

    const { balance } = await this.getBalance(userId);

    if (balance < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    const newBalance = balance - amount;

    // Update balance
    const { error: updateError } = await this.supabase
      .getAdminClient()
      .from('user_credits')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      this.logger.error(
        `Error updating balance for user ${userId}`,
        updateError,
      );
      throw new InternalServerErrorException('Failed to consume credits');
    }

    // Insert transaction
    const { error: txError } = await this.supabase
      .getAdminClient()
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        transaction_type: type,
        reference_id: referenceId,
      });

    if (txError) {
      this.logger.error(
        `Error recording credit transaction for user ${userId}`,
        txError,
      );
      throw new InternalServerErrorException(
        'Failed to record credit transaction',
      );
    }

  }

  /**
   * Adds credits to a user's balance.
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

    const { balance } = await this.getBalance(userId);
    const newBalance = balance + amount;

    let updateError;
    // Check if record exists
    const { data } = await this.supabase
      .getAdminClient()
      .from('user_credits')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      // Insert new
      const { error } = await this.supabase
        .getAdminClient()
        .from('user_credits')
        .insert({ user_id: userId, balance: newBalance });
      updateError = error;
    } else {
      // Update existing
      const { error } = await this.supabase
        .getAdminClient()
        .from('user_credits')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      updateError = error;
    }

    if (updateError) {
      this.logger.error(`Error adding credits for user ${userId}`, updateError);
      throw new InternalServerErrorException('Failed to add credits');
    }

    // Insert transaction
    const { error: txError } = await this.supabase
      .getAdminClient()
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        transaction_type: type,
        description: description,
      });

    if (txError) {
      this.logger.error(
        `Error recording credit transaction for user ${userId}`,
        txError,
      );
    }
  }
}
