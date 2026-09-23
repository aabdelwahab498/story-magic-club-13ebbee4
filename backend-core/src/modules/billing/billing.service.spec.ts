import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { PaymentProvider } from './providers/payment-provider.interface.js';

describe('BillingService', () => {
  let service: BillingService;
  let mockSupabaseClient: any;
  let mockSupabaseService: any;
  let mockPaymentProvider: jest.Mocked<PaymentProvider>;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      rpc: jest.fn().mockResolvedValue({ data: 100, error: null }),
    };

    mockPaymentProvider = {
      name: 'paddle',
      createCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: '/checkout',
        sessionId: 'sess_123',
        priceId: 'pri_pro',
        customData: { user_id: 'user_1', plan_id: 'plan_1' },
      }),
      verifyPayment: jest.fn().mockResolvedValue(true),
      verifyWebhook: jest.fn().mockResolvedValue({
        isValid: true,
        eventId: 'evt_100',
        eventType: 'transaction.completed',
        occurredAt: new Date().toISOString(),
        data: {
          id: 'txn_100',
          customer_id: 'cust_100',
          custom_data: { user_id: 'user_1', plan_id: 'plan_1' },
        },
      }),
      cancelSubscription: jest.fn().mockResolvedValue(true),
    };

    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
      getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
      hasAdminClient: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PADDLE_CLIENT_TOKEN') return 'live_token_123';
              if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
              return null;
            }),
          },
        },
        {
          provide: 'PAYMENT_PROVIDER',
          useValue: mockPaymentProvider,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return frontend paddle config and subscription plans', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [{ id: 'plan_1', tier: 'growth', price_usd: 19 }],
      });

      const config = await service.getConfig();
      expect(config.configured).toBe(true);
      expect(config.clientToken).toBe('live_token_123');
      expect(config.plans).toHaveLength(1);
    });
  });

  describe('createCheckout', () => {
    it('should resolve plan server-side and create checkout session', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { id: 'plan_growth', tier: 'growth', active: true, paddle_price_id: 'pri_123' },
      });
      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const res = await service.createCheckout('user_123', 'growth');
      expect(res.sessionId).toBe('sess_123');
      expect(mockPaymentProvider.createCheckout).toHaveBeenCalledWith(
        'user_123',
        'plan_growth',
        'pri_123',
      );
    });

    it('should throw BadRequestException if plan is not found', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({ data: null });

      await expect(service.createCheckout('user_123', 'unknown_plan')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('should throw UnauthorizedException if signature verification fails', async () => {
      mockPaymentProvider.verifyWebhook.mockResolvedValueOnce({
        isValid: false,
        error: 'INVALID_SIGNATURE',
      });

      await expect(
        service.handleWebhook('paddle', 'raw_body', {}, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should skip duplicate webhook event if already processed', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { event_id: 'evt_100', processed_at: '2026-09-01T00:00:00Z' },
      });

      const res = await service.handleWebhook('paddle', 'raw_body', {}, { event_id: 'evt_100' });
      expect(res.status).toBe('already_processed');
    });

    it('should process transaction.completed event and activate subscription', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: null }) // webhook idempotency check
        .mockResolvedValueOnce({ data: null }) // event ordering check
        .mockResolvedValueOnce({ data: null }) // existing subscription check
        .mockResolvedValueOnce({ data: null }) // existing grant check (subscription_events)
        .mockResolvedValueOnce({ data: { illustration_credits: 250 } }); // plan details

      mockSupabaseClient.upsert.mockResolvedValue({ error: null });
      mockSupabaseClient.insert.mockResolvedValue({ error: null });

      const res = await service.handleWebhook(
        'paddle',
        'raw_body',
        {},
        { event_id: 'evt_100' },
      );

      expect(res.status).toBe('success');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('grant_credits', {
        _user_id: 'user_1',
        _n: 250,
      });
    });

    it('should skip credit grant if credit grant event already recorded for the month', async () => {
      mockSupabaseClient.maybeSingle
        .mockResolvedValueOnce({ data: null }) // webhook idempotency check
        .mockResolvedValueOnce({ data: null }) // event ordering check
        .mockResolvedValueOnce({ data: null }) // existing subscription check
        .mockResolvedValueOnce({ data: { id: 'grant_123' } }); // existing grant check (subscription_events)

      mockSupabaseClient.upsert.mockResolvedValue({ error: null });

      const res = await service.handleWebhook(
        'paddle',
        'raw_body',
        {},
        { event_id: 'evt_101' },
      );

      expect(res.status).toBe('success');
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it('should delegate Paddle webhook to Edge Function when SUPABASE_SERVICE_ROLE_KEY is absent', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        data: { status: 'delegated_to_edge_function' },
        error: null,
      });
      mockSupabaseService.hasAdminClient.mockReturnValue(false);
      mockSupabaseService.getClient.mockReturnValue({
        functions: { invoke: mockInvoke },
      });

      const res = await service.handleWebhook(
        'paddle',
        'raw_body',
        { 'paddle-signature': 'sig' },
        { event_id: 'evt_102' },
      );

      expect(mockInvoke).toHaveBeenCalledWith('paddle-webhook', {
        body: { event_id: 'evt_102' },
        headers: { 'paddle-signature': 'sig' },
      });
      expect(res.status).toBe('delegated_to_edge_function');
    });
  });
});
