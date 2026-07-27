import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { RbacService } from '../rbac.service.js';
import { Role } from '../enums/role.enum.js';
import type { UserContext } from '../interfaces/user-context.interface.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let rbacService: RbacService;

  const editorUser: UserContext = {
    id: 'u1',
    email: 'editor@example.com',
    role: Role.EDITOR,
    roles: [Role.EDITOR],
    permissions: ['story.create'],
  };

  const adminUser: UserContext = {
    id: 'a1',
    email: 'admin@example.com',
    role: Role.ADMIN,
    roles: [Role.ADMIN],
    permissions: [],
  };

  function createMockContext(user: UserContext | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    rbacService = {
      hasAnyRole: jest.fn((u: UserContext, roles: Role[]) =>
        roles.some((r) => u.roles.includes(r)),
      ),
    } as unknown as RbacService;

    guard = new RolesGuard(reflector, rbacService);
  });

  it('should pass when no @Roles() decorator is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext(editorUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass when user has a matching role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.EDITOR, Role.ADMIN]);
    const ctx = createMockContext(editorUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]);
    const ctx = createMockContext(editorUser);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should pass for admin when admin role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(adminUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user context is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
