import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { User } from '@supabase/supabase-js';
import { AuthGuard } from './auth.guard.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { RbacService } from '../modules/rbac/rbac.service.js';
import { Role } from '../modules/rbac/enums/role.enum.js';
import type { UserContext } from '../modules/rbac/interfaces/user-context.interface.js';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;
  let supabaseService: SupabaseService;
  let rbacService: RbacService;
  let configService: ConfigService;
  let verifyToken: jest.Mock;
  let buildUserContext: jest.Mock;

  const userContext: UserContext = {
    id: 'user-123',
    email: 'user@example.com',
    role: Role.EDITOR,
    roles: [Role.EDITOR],
    permissions: ['story.create'],
  };

  function createMockContext(
    headers: Record<string, string | undefined>,
    cookies: Record<string, string> = {},
  ): {
    context: ExecutionContext;
    request: {
      headers: typeof headers;
      cookies: typeof cookies;
      user?: UserContext;
    };
  } {
    const request: {
      headers: typeof headers;
      cookies: typeof cookies;
      user?: UserContext;
    } = {
      headers,
      cookies,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    reflector = new Reflector();
    // Default: route is NOT public.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    verifyToken = jest.fn();
    buildUserContext = jest.fn().mockResolvedValue(userContext);

    supabaseService = {
      verifyToken,
    } as unknown as SupabaseService;

    rbacService = {
      buildUserContext,
    } as unknown as RbacService;

    configService = {
      get: jest.fn().mockReturnValue('najmah_token'),
    } as unknown as ConfigService;

    guard = new AuthGuard(
      supabaseService,
      rbacService,
      reflector,
      configService,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow @Public() routes without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('should throw 401 when the authorization header is missing', async () => {
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('should throw 401 when the token format is invalid and no cookie exists', async () => {
    const { context } = createMockContext({ authorization: 'Token abc123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('should throw 401 when the token is invalid or expired', async () => {
    verifyToken.mockResolvedValue(null);
    const { context } = createMockContext({
      authorization: 'Bearer expired-or-invalid-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyToken).toHaveBeenCalledWith('expired-or-invalid-token');
  });

  it('should attach the UserContext and allow a valid token', async () => {
    const supabaseUser = {
      id: 'user-123',
      email: 'user@example.com',
    } as User;
    verifyToken.mockResolvedValue(supabaseUser);

    const { context, request } = createMockContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(buildUserContext).toHaveBeenCalledWith(
      'user-123',
      'user@example.com',
    );
    expect(request.user).toEqual(userContext);
  });

  it('should pass an empty email string when the Supabase user has no email', async () => {
    const supabaseUser = {
      id: 'user-999',
      email: undefined,
    } as unknown as User;
    verifyToken.mockResolvedValue(supabaseUser);

    const { context } = createMockContext({ authorization: 'Bearer valid' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(buildUserContext).toHaveBeenCalledWith('user-999', '');
  });

  it('should extract token from cookie if Authorization header is missing', async () => {
    const supabaseUser = {
      id: 'user-456',
      email: 'cookie@example.com',
    } as User;
    verifyToken.mockResolvedValue(supabaseUser);

    const { context, request } = createMockContext(
      {},
      { najmah_token: 'cookie-token' },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyToken).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toEqual(userContext);
  });
});
