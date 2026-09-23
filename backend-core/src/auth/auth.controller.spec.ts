import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthController } from './auth.controller.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
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
      verifyOtp: jest.fn(),
      resend: jest.fn(),
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
        if (key === 'AUTH_EMAIL_CONFIRM_REDIRECT_URL')
          return 'https://story-magic-club.lovable.app/auth/callback';
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

  describe('register', () => {
    it('should pass configured emailRedirectTo and return requiresConfirmation=true when session is null', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { session: null, user: { id: 'u-1', email: 'new@user.com' } },
        error: null,
      });

      const result = await controller.register(
        { email: 'new@user.com', password: 'password123', displayName: 'New User' },
        mockRes as Response,
      );

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'new@user.com',
        password: 'password123',
        options: {
          data: { display_name: 'New User' },
          emailRedirectTo: 'https://story-magic-club.lovable.app/auth/callback',
        },
      });
      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Registration successful',
        requiresConfirmation: true,
      });
    });

    it('should set cookie and return requiresConfirmation=false when session exists', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { session: { access_token: 'access-token-123' }, user: { id: 'u-1' } },
        error: null,
      });

      const result = await controller.register(
        { email: 'auto@user.com', password: 'password123' },
        mockRes as Response,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'najmah_token',
        'access-token-123',
        expect.anything(),
      );
      expect(result).toEqual({
        success: true,
        message: 'Registration successful',
        requiresConfirmation: false,
      });
    });

    it('should throw BadRequestException on Supabase error', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'User already registered' },
      });

      await expect(
        controller.register(
          { email: 'existing@user.com', password: 'password123' },
          mockRes as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should call verifyOtp with type=signup, set cookie, and return user details on valid token', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {
          session: { access_token: 'verified-session-token' },
          user: { id: 'user-uuid-1', email: 'verified@example.com' },
        },
        error: null,
      });

      const result = await controller.verifyEmail(
        { token_hash: 'valid_token_hash', type: 'signup' },
        mockRes as Response,
      );

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid_token_hash',
        type: 'signup',
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'najmah_token',
        'verified-session-token',
        expect.anything(),
      );
      expect(result).toEqual({
        success: true,
        message: 'Email verified successfully',
        user: {
          id: 'user-uuid-1',
          email: 'verified@example.com',
        },
      });
      expect(JSON.stringify(result)).not.toContain('verified-session-token');
      expect(JSON.stringify(result)).not.toContain('refresh_token');
    });

    it('should throw BadRequestException when verifyOtp fails or session is missing', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token is expired or invalid' },
      });

      await expect(
        controller.verifyEmail(
          { token_hash: 'invalid_hash', type: 'signup' },
          mockRes as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('VerifyEmailDto validation', () => {
    it('should pass validation when type is signup', async () => {
      const dto = new VerifyEmailDto();
      dto.token_hash = 'valid-token';
      dto.type = 'signup' as any;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when type is recovery', async () => {
      const dto = new VerifyEmailDto();
      dto.token_hash = 'valid-token';
      dto.type = 'recovery' as any;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('type');
    });

    it('should fail validation when type is email_change', async () => {
      const dto = new VerifyEmailDto();
      dto.token_hash = 'valid-token';
      dto.type = 'email_change' as any;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('type');
    });

    it('should fail validation when type is email', async () => {
      const dto = new VerifyEmailDto();
      dto.token_hash = 'valid-token';
      dto.type = 'email' as any;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('type');
    });

    it('should fail validation when type is magiclink or invite or arbitrary', async () => {
      for (const invalidType of ['magiclink', 'invite', 'arbitrary_type']) {
        const dto = new VerifyEmailDto();
        dto.token_hash = 'valid-token';
        dto.type = invalidType as any;
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('type');
      }
    });
  });

  describe('resendConfirmation', () => {
    it('should call auth.resend with type signup and configured redirect', async () => {
      mockSupabaseClient.auth.resend.mockResolvedValue({ error: null });

      const result = await controller.resendConfirmation({
        email: 'user@example.com',
      });

      expect(mockSupabaseClient.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@example.com',
        options: {
          emailRedirectTo: 'https://story-magic-club.lovable.app/auth/callback',
        },
      });
      expect(result).toEqual({
        success: true,
        message:
          'If an unverified account exists for this email, a confirmation link has been sent.',
      });
    });

    it('should return safe generic message even if Supabase resend throws error', async () => {
      mockSupabaseClient.auth.resend.mockRejectedValue(
        new Error('User not found or already confirmed'),
      );

      const result = await controller.resendConfirmation({
        email: 'nonexistent@example.com',
      });

      expect(result).toEqual({
        success: true,
        message:
          'If an unverified account exists for this email, a confirmation link has been sent.',
      });
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
