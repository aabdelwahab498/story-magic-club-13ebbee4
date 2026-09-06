/// <reference types="vite/client" />

/**
 * Central RBAC utility – pure functions without React dependencies.
 * Exported types are used throughout the front‑end for strong typing.
 */

// Role definitions – must stay in sync with the database enum `app_role`
// and the backend `Role` enum (admin, editor, user, super_admin, support).
export type AppRole = 'admin' | 'editor' | 'user' | 'super_admin' | 'support';

// Permission keys are strings stored in the `rbac_permissions` table.
export type PermissionKey = string;

/** Roles that implicitly hold every permission (mirrors backend bypass). */
export const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin'];

/**
 * Return true if the user roles include the required role.
 * @param userRoles - List of roles the user possesses.
 * @param requiredRole - Role required for access.
 */
export function hasRole(userRoles: AppRole[], requiredRole: AppRole): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * Return true if the permission list includes the required permission key.
 * Admins are granted all permissions by convention – callers may shortcut that.
 * @param permissions - List of permission keys granted to the user.
 * @param requiredPermission - Permission key needed for the operation.
 */
export function hasPermission(
  permissions: PermissionKey[],
  requiredPermission: PermissionKey,
): boolean {
  return permissions.includes(requiredPermission);
}

/** Remove duplicates while preserving order. */
export function dedupe<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}
