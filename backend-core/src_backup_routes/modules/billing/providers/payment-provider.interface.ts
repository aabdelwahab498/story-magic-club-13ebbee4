export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

export interface PaymentProvider {
  /**
   * Create a checkout session for a specific plan.
   */
  createCheckout(userId: string, planId: string): Promise<CheckoutResult>;

  /**
   * Verify an existing payment by transaction ID.
   */
  verifyPayment(transactionId: string): Promise<boolean>;

  /**
   * Process a webhook payload from the provider.
   * Return true if the webhook was handled successfully and indicates a successful payment.
   */
  handleWebhook(payload: any): Promise<boolean>;
}
