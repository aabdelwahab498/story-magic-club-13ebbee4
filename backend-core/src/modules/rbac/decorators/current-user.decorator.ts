import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserContext } from '../interfaces/user-context.interface.js';

/**
 * Parameter decorator that extracts the authenticated UserContext from
 * the request object. The UserContext is attached by AuthGuard after
 * JWT verification and RBAC resolution.
 *
 * @example
 * ```ts
 * @Get('me')
 * getMe(@CurrentUser() user: UserContext) {
 *   return user;
 * }
 * ```
 *
 * You can also extract a single property:
 * ```ts
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: UserContext }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
