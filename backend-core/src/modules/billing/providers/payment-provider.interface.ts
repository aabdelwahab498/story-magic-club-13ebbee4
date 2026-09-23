export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  priceId?: string;
  customData?: Record<string, any>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventId?: string;
  eventType?: string;
  occurredAt?: string;
  data?: any;
  error?: string;
}

export interface PaymentProvider {
  /**
   * Unique name of the payment provider (e.g., 'paddle', 'mock')
   */
  readonly name: string;

  /**
   * Create a checkout session or metadata for a specific plan.
   */
  createCheckout(
    userId: string,
    planId: string,
    planPriceId?: string,
  ): Promise<CheckoutResult>;

  /**
   * Verify an existing payment by transaction ID.
   */
  verifyPayment(transactionId: string): Promise<boolean>;

  /**
   * Cryptographically verify and parse a webhook payload from the provider.
   */
  verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, any>,
  ): Promise<WebhookVerificationResult>;

  /**
   * Cancel an active subscription at the provider.
   */
  cancelSubscription(subscriptionId: string): Promise<boolean>;
}
