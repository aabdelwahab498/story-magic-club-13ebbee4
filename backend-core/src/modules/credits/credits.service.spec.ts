import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreditsService } from './credits.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

describe('CreditsService', () => {
  let service: CreditsService;
  let mockSupabaseClient: any;
  let supabaseServiceMock: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn(),
    };

    supabaseServiceMock = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        {
          provide: SupabaseService,
          useValue: supabaseServiceMock,
        },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('illustration_credits balance 20 => getBalance returns 20', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'illustration_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { balance: 20 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await service.getBalance('user-1');
    expect(supabaseServiceMock.getUserClient).toHaveBeenCalled();
    expect(result.balance).toBe(20);
  });

  it('canonical row takes precedence over user_credits', async () => {
    const userCreditsSpy = jest.fn();
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'illustration_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { balance: 20 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_credits') {
        userCreditsSpy();
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { balance: 5 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await service.getBalance('user-1');
    expect(result.balance).toBe(20);
    expect(userCreditsSpy).not.toHaveBeenCalled();
  });

  it('canonical query error does NOT silently become balance 0', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'illustration_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'RLS permission denied' },
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(service.getBalance('user-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('consume 1 changes 20 -> 19 exactly once', async () => {
    const txCheckMock = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    const icUpdateSpy = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const icMock = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { user_id: 'user-1', balance: 20 },
            error: null,
          }),
        }),
      }),
      update: icUpdateSpy,
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'credit_transactions') return txCheckMock;
      if (table === 'illustration_credits') return icMock;
      return {};
    });

    await service.consumeCredits('user-1', 1, 'ILLUSTRATION_GENERATION', 'ref-100');

    expect(icUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 19 }),
    );
    expect(txCheckMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        amount: -1,
        transaction_type: 'ILLUSTRATION_GENERATION',
        reference_id: 'ref-100',
      }),
    );
  });

  it('duplicate referenceId does not debit twice', async () => {
    const existingTxMock = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'tx-existing' },
                error: null,
              }),
            }),
          }),
        }),
      }),
      insert: jest.fn(),
    };

    const icUpdateSpy = jest.fn();

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'credit_transactions') return existingTxMock;
      if (table === 'illustration_credits') return { update: icUpdateSpy };
      return {};
    });

    await service.consumeCredits('user-1', 1, 'ILLUSTRATION_GENERATION', 'ref-dup');

    expect(icUpdateSpy).not.toHaveBeenCalled();
    expect(existingTxMock.insert).not.toHaveBeenCalled();
  });

  it('no canonical row can use compatibility fallback', async () => {
    const txMock = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    const ucUpdateSpy = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'credit_transactions') return txMock;
      if (table === 'illustration_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'user_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'uc-1', balance: 10 },
                error: null,
              }),
            }),
          }),
          update: ucUpdateSpy,
        };
      }
      return {};
    });

    const balanceRes = await service.getBalance('user-1');
    expect(balanceRes.balance).toBe(10);

    await service.consumeCredits('user-1', 1, 'STORY_GENERATION', 'ref-fallback');
    expect(ucUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ balance: 9 }),
    );
  });

  it('insufficient real balance still rejects', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'credit_transactions') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'illustration_credits') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { user_id: 'user-1', balance: 0 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      service.consumeCredits('user-1', 1, 'ILLUSTRATION_GENERATION', 'ref-fail'),
    ).rejects.toThrow(BadRequestException);
  });
});
