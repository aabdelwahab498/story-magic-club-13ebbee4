import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { Role } from './enums/role.enum.js';
import type { UserContext } from './interfaces/user-context.interface.js';

/**
 * Row shape returned by `user_roles` table queries.
 * Mirrors the Supabase generated type for the `user_roles` table.
 */
interface UserRoleRow {
  role: string;
}

/**
 * Row shape returned by `rbac_permissions` table queries.
 */
interface PermissionRow {
  permission_key: string;
}

/**
 * Core RBAC service responsible for:
 * 1. Fetching a user's roles from the `user_roles` table.
 * 2. Fetching a user's granted permissions from the `rbac_permissions` table.
 * 3. Building a complete UserContext from a Supabase User.
 * 4. Providing role and permission check helpers.
 *
 * All database queries use the admin client (service role) to bypass RLS,
 * since this runs server-side after JWT verification.
 */
@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Build a complete UserContext for the authenticated user.
   * Queries `user_roles` and `rbac_permissions` tables via the admin client.
   *
   * @param userId - The verified Supabase auth user ID.
   * @param email  - The verified email from the JWT.
   * @returns A fully populated UserContext.
   */
  async buildUserContext(userId: string, email: string): Promise<UserContext> {
    const roles = await this.fetchRoles(userId);
    const permissions = await this.fetchPermissions(roles);

    // Primary role: highest-privilege role, or default to USER
    const primaryRole = this.resolvePrimaryRole(roles);

    return {
      id: userId,
      email,
      role: primaryRole,
      roles,
      permissions,
    };
  }

  /**
   * Check whether the user holds the specified role.
   */
  hasRole(user: UserContext, requiredRole: Role): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * Check whether the user holds ANY of the specified roles.
   */
  hasAnyRole(user: UserContext, requiredRoles: Role[]): boolean {
    return requiredRoles.some((role) => user.roles.includes(role));
  }

  /**
   * Check whether the user has the specified permission.
   * Admins and super_admins are granted all permissions implicitly.
   */
  hasPermission(user: UserContext, requiredPermission: string): boolean {
    if (
      user.roles.includes(Role.ADMIN) ||
      user.roles.includes(Role.SUPER_ADMIN)
    ) {
      return true;
    }
    return user.permissions.includes(requiredPermission);
  }

  /**
   * Check whether the user has ALL of the specified permissions.
   */
  hasAllPermissions(user: UserContext, requiredPermissions: string[]): boolean {
    if (
      user.roles.includes(Role.ADMIN) ||
      user.roles.includes(Role.SUPER_ADMIN)
    ) {
      return true;
    }
    return requiredPermissions.every((perm) => user.permissions.includes(perm));
  }

  // ───────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Fetch all roles assigned to a user from the `user_roles` table.
   */
  private async fetchRoles(userId: string): Promise<Role[]> {
    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to fetch roles for user ${userId}: ${error.message}`,
      );
      return [Role.USER]; // Fail-safe: default to USER role
    }

    const rows = (data ?? []) as UserRoleRow[];
    const roles = rows
      .map((r) => r.role as Role)
      .filter((r) => Object.values(Role).includes(r));

    return roles.length > 0 ? roles : [Role.USER];
  }

  /**
   * Fetch granted permissions for a set of roles from the `rbac_permissions` table.
   * If the table does not exist or the query fails, returns an empty array.
   */
  private async fetchPermissions(roles: Role[]): Promise<string[]> {
    if (roles.length === 0) return [];

    // Admin and super_admin have implicit full access
    if (roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN)) {
      return [];
    }

    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('rbac_permissions')
      .select('permission_key')
      .in('role', roles as string[])
      .eq('granted', true);

    if (error) {
      // The rbac_permissions table may not exist yet in all environments
      this.logger.warn(
        `Failed to fetch permissions: ${error.message}. Returning empty permissions.`,
      );
      return [];
    }

    const rows = (data ?? []) as PermissionRow[];
    return [...new Set(rows.map((p) => p.permission_key))];
  }

  /**
   * Determine the primary (highest-privilege) role from the user's role list.
   * Precedence: super_admin > admin > support > editor > user.
   */
  private resolvePrimaryRole(roles: Role[]): Role {
    const precedence: Role[] = [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.SUPPORT,
      Role.EDITOR,
      Role.USER,
    ];

    for (const role of precedence) {
      if (roles.includes(role)) {
        return role;
      }
    }

    return Role.USER;
  }
}
