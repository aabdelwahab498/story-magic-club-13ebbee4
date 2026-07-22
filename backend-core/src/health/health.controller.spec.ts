import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  let controller: HealthController;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  };

  const mockSupabaseService: Pick<SupabaseService, 'getClient'> = {
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  const mockRedisService = {
    getIsEnabled: jest.fn().mockReturnValue(false),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'PYTHON_AI_URL') return 'http://localhost:8000';
      return null;
    }),
  };

  beforeEach(async () => {
    // Mock global fetch to return OK status for Python AI
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ status: 'ok' }),
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return status ok with a timestamp', () => {
      const res = controller.getHealth();
      expect(res.status).toBe('ok');
      expect(typeof res.timestamp).toBe('string');
      expect(new Date(res.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('getLive', () => {
    it('should return status ok', () => {
      const res = controller.getLive();
      expect(res.status).toBe('ok');
    });
  });

  describe('getReady', () => {
    it('should return ready status when database query succeeds', async () => {
      const res = await controller.getReady();
      expect(res.status).toBe('ready');
      expect(res.database).toBe('connected');
    });

    it('should throw ServiceUnavailableException when database returns an error', async () => {
      mockSupabaseClient.limit.mockResolvedValueOnce({
        data: null,
        error: new Error('DB Connection Refused'),
      });

      await expect(controller.getReady()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getVersion', () => {
    it('should return version 2.0.0 at production_hardening stage', () => {
      const res = controller.getVersion();
      expect(res.version).toBe('2.0.0');
      expect(res.stage).toBe('production_hardening');
    });
  });
});
