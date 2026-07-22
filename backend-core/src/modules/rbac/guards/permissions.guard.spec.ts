import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard.js';
import { RbacService } from '../rbac.service.js';
import { Role } from '../enums/role.enum.js';
import { Permission } from '../enums/permission.enum.js';
import type { UserContext } from '../interfaces/user-context.interface.js';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let rbacService: RbacService;

  const editorWithPerms: UserContext = {
    id: 'u1',
    email: 'editor@example.com',
    role: Role.EDITOR,
    roles: [Role.EDITOR],
    permissions: ['story.create', 'story.read'],
  };

  const editorWithoutPerms: UserContext = {
    id: 'u2',
    email: 'editor2@example.com',
    role: Role.EDITOR,
    roles: [Role.EDITOR],
    permissions: ['story.read'],
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
      hasAllPermissions: jest.fn((u: UserContext, perms: string[]) => {
        if (u.roles.includes(Role.ADMIN) || u.roles.includes(Role.SUPER_ADMIN))
          return true;
        return perms.every((p) => u.permissions.includes(p));
      }),
    } as unknown as RbacService;

    guard = new PermissionsGuard(reflector, rbacService);
  });

  it('should pass when no @Permissions() decorator is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext(editorWithPerms);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass when user has all required permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.STORY_CREATE, Permission.STORY_READ]);
    const ctx = createMockContext(editorWithPerms);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks a permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.STORY_CREATE, Permission.STORY_READ]);
    const ctx = createMockContext(editorWithoutPerms);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should pass for admin even without explicit permissions', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.BILLING_MANAGE]);
    const ctx = createMockContext(adminUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user context is missing', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Permission.STORY_READ]);
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
