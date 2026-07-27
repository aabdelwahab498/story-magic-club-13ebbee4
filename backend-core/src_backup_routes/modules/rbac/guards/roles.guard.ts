import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../enums/role.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RbacService } from '../rbac.service.js';
import type { UserContext } from '../interfaces/user-context.interface.js';

/**
 * Guard that enforces role-based access control on routes decorated
 * with @Roles(). If no @Roles() decorator is present the guard
 * passes through (open to any authenticated user).
 *
 * Executed AFTER AuthGuard, so request.user is guaranteed to exist.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → open to all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: UserContext }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    const hasRole = this.rbacService.hasAnyRole(user, requiredRoles);
    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient role. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
