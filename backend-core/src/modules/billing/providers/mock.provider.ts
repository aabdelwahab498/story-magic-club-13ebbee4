import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CheckoutResult,
  WebhookVerificationResult,
} from './payment-provider.interface.js';

@Injectable()
export class MockProvider implements PaymentProvider {
  private readonly logger = new Logger(MockProvider.name);

  get name(): string {
    return 'mock';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createCheckout(
    userId: string,
    planId: string,
    planPriceId?: string,
  ): Promise<CheckoutResult> {
    this.logger.log(
      `[MOCK] Creating checkout for user ${userId}, plan ${planId}`,
    );

    const sessionId = `mock_session_${Date.now()}`;

    return {
      checkoutUrl: `/payment/result?status=SUCCESS&transactionId=${sessionId}`,
      sessionId,
      priceId: planPriceId || 'mock_price_123',
      customData: { user_id: userId, plan_id: planId },
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyPayment(transactionId: string): Promise<boolean> {
    this.logger.log(`[MOCK] Verifying payment for transaction ${transactionId}`);
    return transactionId.startsWith('mock_session_');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, any>,
  ): Promise<WebhookVerificationResult> {
    this.logger.log(`[MOCK] Verifying webhook payload`);
    let payload: any = {};
    try {
      payload =
        typeof rawBody === 'string'
          ? JSON.parse(rawBody)
          : Buffer.isBuffer(rawBody)
            ? JSON.parse(rawBody.toString('utf8'))
            : rawBody;
    } catch {
      payload = rawBody;
    }

    return {
      isValid: true,
      eventId: payload?.event_id || payload?.id || `evt_mock_${Date.now()}`,
      eventType: payload?.event_type || 'transaction.completed',
      occurredAt: payload?.occurred_at || new Date().toISOString(),
      data: payload?.data || payload,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    this.logger.log(`[MOCK] Canceling subscription ${subscriptionId}`);
    return true;
  }
}
