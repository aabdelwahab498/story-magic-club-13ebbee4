import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';
import { RbacService } from '../modules/rbac/rbac.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { UserContext } from '../modules/rbac/interfaces/user-context.interface.js';
import { RequestContext } from '../common/middleware/request-context.js';

/**
 * Global authentication guard.
 *
 * For every incoming request this guard:
 * 1. Checks if the route is marked @Public() — if so, skips auth.
 * 2. Extracts and validates the Bearer token via SupabaseService.
 * 3. Builds a full UserContext (id, email, role, roles, permissions)
 *    via RbacService and attaches it to `request.user`.
 *
 * Downstream guards (RolesGuard, PermissionsGuard) and the @CurrentUser()
 * decorator rely on `request.user` being a valid UserContext.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly rbacService: RbacService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    let token: string | undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieName = this.configService.get<string>(
        'JWT_COOKIE_NAME',
        'najmah_token',
      );
      // Ensure we safely read cookies in case cookie-parser isn't initialized yet
      token = request.cookies?.[cookieName];
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const user = await this.supabaseService.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Build the full user context with roles and permissions
    const userContext = await this.rbacService.buildUserContext(
      user.id,
      user.email ?? '',
    );

    // Set user ID and authToken in request context
    RequestContext.userId = user.id;
    RequestContext.authToken = token;

    // Attach the UserContext to the request for downstream use
    (request as Request & { user: UserContext }).user = userContext;
    return true;
  }
}
