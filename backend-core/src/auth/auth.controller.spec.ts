import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let supabaseService: jest.Mocked<SupabaseService>;
  let configService: jest.Mocked<ConfigService>;
  let mockRes: jest.Mocked<Partial<Response>>;

  const mockSupabaseClient = {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  };

  beforeEach(async () => {
    supabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as jest.Mocked<SupabaseService>;

    configService = {
      get: jest.fn().mockImplementation((key, defaultValue) => {
        if (key === 'JWT_COOKIE_NAME') return 'najmah_token';
        if (key === 'JWT_COOKIE_SECURE') return true;
        if (key === 'JWT_COOKIE_SAMESITE') return 'lax';
        if (key === 'JWT_COOKIE_MAX_AGE') return 3600;
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: SupabaseService, useValue: supabaseService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should set cookie on successful login', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'fake-token' } },
        error: null,
      });

      const result = await controller.login(
        { email: 'test@test.com', password: 'password' },
        mockRes as Response,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'najmah_token',
        'fake-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 3600000,
          path: '/',
        }),
      );
      expect(result).toEqual({
        success: true,
        message: 'Logged in successfully',
      });
    });

    it('should throw UnauthorizedException on error', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        controller.login(
          { email: 'test@test.com', password: 'password' },
          mockRes as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear cookie and call signOut', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const result = await controller.logout(mockRes as Response);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('najmah_token', {
        path: '/',
      });
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
});
