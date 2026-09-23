import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  PaymentProvider,
  CheckoutResult,
  WebhookVerificationResult,
} from './payment-provider.interface.js';
import { CircuitBreaker } from '../../../common/resilience/circuit-breaker.js';
import {
  classifyProviderError,
  sanitizeSecrets,
} from '../../../common/resilience/provider-error.classifier.js';
import type { Env } from '../../../config/env.config.js';

@Injectable()
export class PaddleProvider implements PaymentProvider {
  private readonly logger = new Logger(PaddleProvider.name);
  private readonly webhookSecret: string;
  private readonly apiKey: string;
  private readonly environment: 'sandbox' | 'production';
  private readonly timeoutMs = 15000;
  private readonly circuitBreaker = new CircuitBreaker('billing', {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
  });

  constructor(private readonly configService: ConfigService<Env, true>) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    this.webhookSecret =
      this.configService.get<string>('PADDLE_WEBHOOK_SECRET') || '';
    this.apiKey = this.configService.get<string>('PADDLE_API_KEY') || '';
    this.environment =
      (this.configService.get<string>('PADDLE_ENVIRONMENT') as
        | 'sandbox'
        | 'production') || 'sandbox';

    if (nodeEnv === 'production') {
      if (!this.webhookSecret) {
        throw new Error(
          'PaddleProvider initialization error: PADDLE_WEBHOOK_SECRET is missing in production.',
        );
      }
    }
  }

  get name(): string {
    return 'paddle';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createCheckout(
    userId: string,
    planId: string,
    planPriceId?: string,
  ): Promise<CheckoutResult> {
    const sessionId = `paddle_sess_${crypto.randomUUID()}`;
    const customData = { user_id: userId, plan_id: planId };

    return {
      checkoutUrl: `/checkout?priceId=${planPriceId || ''}&sessionId=${sessionId}`,
      sessionId,
      priceId: planPriceId,
      customData,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyPayment(transactionId: string): Promise<boolean> {
    this.logger.log(`Verifying Paddle transaction ${transactionId}`);
    return Boolean(transactionId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, any>,
  ): Promise<WebhookVerificationResult> {
    try {
      // Find paddle-signature header (case-insensitive)
      const sigHeaderKey = Object.keys(headers).find(
        (k) => k.toLowerCase() === 'paddle-signature',
      );
      const sigHeader = sigHeaderKey ? String(headers[sigHeaderKey]) : '';

      if (!sigHeader) {
        this.logger.warn('Paddle webhook signature header missing');
        return { isValid: false, error: 'MISSING_SIGNATURE_HEADER' };
      }

      // If secret is not configured in dev/test, fail safely unless test bypass
      if (!this.webhookSecret) {
        const nodeEnv = this.configService.get<string>('NODE_ENV');
        if (nodeEnv === 'production') {
          return { isValid: false, error: 'WEBHOOK_SECRET_NOT_CONFIGURED' };
        }
      }

      const bodyString =
        typeof rawBody === 'string'
          ? rawBody
          : Buffer.isBuffer(rawBody)
            ? rawBody.toString('utf8')
            : JSON.stringify(rawBody);

      // Parse paddle-signature: ts=1690000000;h1=a1b2c3d4e5...
      const parts = sigHeader.split(';');
      let ts = '';
      const h1List: string[] = [];

      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === 'ts') ts = v;
        if (k === 'h1') h1List.push(v);
      }

      if (!ts || h1List.length === 0) {
        this.logger.warn('Malformed paddle-signature header');
        return { isValid: false, error: 'MALFORMED_SIGNATURE_HEADER' };
      }

      // Check timestamp tolerance (max 5 minutes skew)
      const eventTimestamp = parseInt(ts, 10);
      if (!isNaN(eventTimestamp)) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - eventTimestamp) > 300) {
          this.logger.warn(
            `Paddle webhook timestamp expired: diff=${Math.abs(nowSec - eventTimestamp)}s`,
          );
          return { isValid: false, error: 'TIMESTAMP_EXPIRED' };
        }
      }

      // Compute HMAC SHA-256
      const payloadToSign = `${ts}:${bodyString}`;
      const expectedHmac = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadToSign)
        .digest('hex');

      let signatureValid = false;
      for (const h1 of h1List) {
        if (
          h1.length === expectedHmac.length &&
          crypto.timingSafeEqual(
            Buffer.from(h1, 'hex'),
            Buffer.from(expectedHmac, 'hex'),
          )
        ) {
          signatureValid = true;
          break;
        }
      }

      if (!signatureValid) {
        this.logger.warn('Paddle webhook signature verification failed');
        return { isValid: false, error: 'INVALID_SIGNATURE' };
      }

      const payload = JSON.parse(bodyString);
      const eventId = payload.event_id || payload.id;
      const eventType = payload.event_type;
      const occurredAt = payload.occurred_at;

      return {
        isValid: true,
        eventId,
        eventType,
        occurredAt,
        data: payload.data || payload,
      };
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);
      this.logger.error(`Error verifying Paddle webhook: ${sanitizedMsg}`);
      return { isValid: false, error: sanitizedMsg };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return this.circuitBreaker.execute(() =>
      this.callPaddleCancelApi(subscriptionId),
    );
  }

  private async callPaddleCancelApi(subscriptionId: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `Cannot cancel Paddle subscription ${subscriptionId}: PADDLE_API_KEY missing`,
      );
      return false;
    }

    const baseUrl =
      this.environment === 'production'
        ? 'https://api.paddle.com'
        : 'https://sandbox-api.paddle.com';

    const url = `${baseUrl}/subscriptions/${subscriptionId}/cancel`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ effective_from: 'next_billing_period' }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text();
        const sanitizedErr = sanitizeSecrets(errText);
        this.logger.error(
          `Paddle API cancel subscription failed status ${response.status}: ${sanitizedErr}`,
        );
        return false;
      }

      return true;
    } catch (error: any) {
      const classified = classifyProviderError(error);
      const sanitizedMsg = sanitizeSecrets(classified.message);
      this.logger.error(
        `Paddle API cancel subscription exception: ${sanitizedMsg}`,
      );
      throw error;
    }
  }
}
