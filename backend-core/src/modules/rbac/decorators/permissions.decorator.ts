import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/permission.enum.js';

/**
 * Metadata key used by PermissionsGuard to read required permissions.
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator that restricts a route to users holding ALL of the specified
 * permissions. Admins bypass this check.
 *
 * @example
 * ```ts
 * @Permissions(Permission.STORY_CREATE, Permission.STORY_READ)
 * @Post('stories')
 * createStory() { ... }
 * ```
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
