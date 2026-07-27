import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, CheckoutResult } from './payment-provider.interface.js';

@Injectable()
export class MockProvider implements PaymentProvider {
  private readonly logger = new Logger(MockProvider.name);

  async createCheckout(userId: string, planId: string): Promise<CheckoutResult> {
    this.logger.log(`[MOCK] Creating checkout for user ${userId}, plan ${planId}`);
    
    // Generates a fake session ID based on current time
    const sessionId = `mock_session_${Date.now()}`;
    
    return {
      checkoutUrl: `/payment/result?status=SUCCESS&transactionId=${sessionId}`,
      sessionId,
    };
  }

  async verifyPayment(transactionId: string): Promise<boolean> {
    this.logger.log(`[MOCK] Verifying payment for transaction ${transactionId}`);
    // Mock provider always assumes success for demo purposes if it starts with mock_session
    return transactionId.startsWith('mock_session_');
  }

  async handleWebhook(payload: any): Promise<boolean> {
    this.logger.log(`[MOCK] Handling webhook payload: ${JSON.stringify(payload)}`);
    // Mock provider just says true
    return true;
  }
}
