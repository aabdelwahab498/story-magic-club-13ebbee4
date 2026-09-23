import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { PaddleProvider } from './paddle.provider.js';

describe('PaddleProvider', () => {
  let provider: PaddleProvider;
  const secret = 'test_webhook_secret_123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaddleProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PADDLE_WEBHOOK_SECRET') return secret;
              if (key === 'PADDLE_API_KEY') return 'test_api_key';
              if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<PaddleProvider>(PaddleProvider);
  });

  it('should be defined with name paddle', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('paddle');
  });

  describe('verifyWebhook', () => {
    it('should reject webhook if paddle-signature header is missing', async () => {
      const result = await provider.verifyWebhook('{}', {});
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('MISSING_SIGNATURE_HEADER');
    });

    it('should successfully verify valid paddle signature', async () => {
      const payload = JSON.stringify({
        event_id: 'evt_12345',
        event_type: 'transaction.completed',
        occurred_at: new Date().toISOString(),
        data: { id: 'txn_999', status: 'completed' },
      });

      const ts = Math.floor(Date.now() / 1000).toString();
      const payloadToSign = `${ts}:${payload}`;
      const h1 = crypto
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');

      const headers = {
        'paddle-signature': `ts=${ts};h1=${h1}`,
      };

      const result = await provider.verifyWebhook(payload, headers);
      expect(result.isValid).toBe(true);
      expect(result.eventId).toBe('evt_12345');
      expect(result.eventType).toBe('transaction.completed');
    });

    it('should reject webhook if signature digest is invalid', async () => {
      const payload = JSON.stringify({ event_id: 'evt_bad' });
      const ts = Math.floor(Date.now() / 1000).toString();
      const headers = {
        'paddle-signature': `ts=${ts};h1=invalid_digest_hex_string_1234567890123456789012345678901234567890123456789012345678901234`,
      };

      const result = await provider.verifyWebhook(payload, headers);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('should reject webhook if timestamp is older than 5 minutes', async () => {
      const payload = JSON.stringify({ event_id: 'evt_old' });
      const ts = (Math.floor(Date.now() / 1000) - 400).toString(); // 400s old (> 300s)
      const payloadToSign = `${ts}:${payload}`;
      const h1 = crypto
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('hex');

      const headers = {
        'paddle-signature': `ts=${ts};h1=${h1}`,
      };

      const result = await provider.verifyWebhook(payload, headers);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('TIMESTAMP_EXPIRED');
    });
  });

  describe('createCheckout', () => {
    it('should create checkout result with priceId and customData', async () => {
      const result = await provider.createCheckout('user_123', 'plan_pro', 'pri_999');
      expect(result.priceId).toBe('pri_999');
      expect(result.customData).toEqual({ user_id: 'user_123', plan_id: 'plan_pro' });
      expect(result.sessionId).toContain('paddle_sess_');
    });
  });
});
