import { Role } from '../enums/role.enum.js';

/**
 * Authenticated user context attached to every request by AuthGuard.
 *
 * This interface is the single source of truth for user identity data
 * flowing through the request pipeline. Guards, decorators, and controllers
 * all reference this shape.
 */
export interface UserContext {
  /** Supabase auth user ID (UUID). */
  readonly id: string;

  /** User's verified email address. */
  readonly email: string;

  /** Primary role from the `user_roles` table. */
  readonly role: Role;

  /** All roles assigned to this user (users may hold multiple roles). */
  readonly roles: Role[];

  /** Granted permission keys derived from the user's roles. */
  readonly permissions: string[];
}
