import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Permission } from '../enums/permission.enum.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { RbacService } from '../rbac.service.js';
import type { UserContext } from '../interfaces/user-context.interface.js';

/**
 * Guard that enforces permission-based access control on routes
 * decorated with @Permissions(). If no @Permissions() decorator is
 * present the guard passes through.
 *
 * Admins and super_admins bypass all permission checks (handled by
 * RbacService.hasAllPermissions).
 *
 * Executed AFTER AuthGuard and RolesGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      Permission[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No @Permissions() decorator → open to all authenticated users
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: UserContext }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    const hasPermissions = this.rbacService.hasAllPermissions(
      user,
      requiredPermissions,
    );

    if (!hasPermissions) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
