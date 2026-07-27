import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../rbac/decorators/current-user.decorator.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

/**
 * Response shape for the GET /me endpoint.
 */
interface MeResponse {
  id: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
}

/**
 * Controller exposing the authenticated user's identity and RBAC context.
 *
 * This endpoint requires a valid Bearer token (enforced by the global
 * AuthGuard). It is NOT decorated with @Public().
 *
 * ROUTE CONTRACT: This resolves to `GET /api/v2/me`.
 * The `api` prefix comes from `app.setGlobalPrefix('api')` and the `v2`
 * segment from the global URI versioning default ('2') configured in
 * `main.ts` (`app.enableVersioning`). There is intentionally no explicit
 * `@Version()` here; the route inherits the global default version.
 */
@Controller('me')
export class MeController {
  /**
   * Returns the authenticated user's identity, primary role, all assigned
   * roles, and their granted permissions.
   *
   * @example Response:
   * ```json
   * {
   *   "id": "uuid",
   *   "email": "user@example.com",
   *   "role": "editor",
   *   "roles": ["editor", "user"],
   *   "permissions": ["story.create", "story.read"]
   * }
   * ```
   */
  @Get()
  getMe(@CurrentUser() user: UserContext): MeResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
