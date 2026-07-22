import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';

/**
 * Metadata key used by RolesGuard to read required roles from route handlers.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator that restricts a route to users holding at least one of the
 * specified roles.
 *
 * @example
 * ```ts
 * @Roles(Role.ADMIN, Role.EDITOR)
 * @Get('admin-panel')
 * getAdminPanel() { ... }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
