import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { Role } from './enums/role.enum.js';
import type { UserContext } from './interfaces/user-context.interface.js';

describe('RbacService', () => {
  let service: RbacService;

  // ── Mock Supabase client chain ──────────────────────────────────────────
  const mockRolesQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({
      data: [{ role: 'editor' }],
      error: null,
    }),
  };

  const mockPermissionsQuery = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({
      data: [
        { permission_key: 'story.create' },
        { permission_key: 'story.read' },
      ],
      error: null,
    }),
  };

  const mockAdminClient = {
    from: jest.fn((table: string) => {
      if (table === 'user_roles') return mockRolesQuery;
      if (table === 'rbac_permissions') return mockPermissionsQuery;
      return mockRolesQuery;
    }),
  };

  const mockSupabaseService: Pick<SupabaseService, 'getAdminClient' | 'getUserClient'> = {
    getAdminClient: jest.fn().mockReturnValue(mockAdminClient),
    getUserClient: jest.fn().mockReturnValue(mockAdminClient as any),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── buildUserContext ──────────────────────────────────────────────────

  describe('buildUserContext', () => {
    it('should build a complete user context with roles and permissions', async () => {
      const ctx = await service.buildUserContext(
        'user-123',
        'editor@example.com',
      );

      expect(ctx.id).toBe('user-123');
      expect(ctx.email).toBe('editor@example.com');
      expect(ctx.role).toBe(Role.EDITOR);
      expect(ctx.roles).toEqual([Role.EDITOR]);
      expect(ctx.permissions).toEqual(
        expect.arrayContaining(['story.create', 'story.read']),
      );
    });

    it('should default to USER role when user_roles returns no rows', async () => {
      mockRolesQuery.eq.mockResolvedValueOnce({ data: [], error: null });

      const ctx = await service.buildUserContext('user-456', 'new@example.com');

      expect(ctx.role).toBe(Role.USER);
      expect(ctx.roles).toEqual([Role.USER]);
    });

    it('should throw InternalServerErrorException when user_roles query fails (fail-closed)', async () => {
      mockRolesQuery.eq.mockResolvedValueOnce({
        data: null,
        error: new Error('DB error'),
      });

      await expect(
        service.buildUserContext('user-789', 'err@example.com'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should return empty permissions and skip DB query for admin role', async () => {
      mockRolesQuery.eq.mockResolvedValueOnce({
        data: [{ role: 'admin' }],
        error: null,
      });

      const ctx = await service.buildUserContext(
        'admin-1',
        'admin@example.com',
      );

      expect(ctx.role).toBe(Role.ADMIN);
      expect(ctx.permissions).toEqual([]);
      // rbac_permissions should NOT have been queried
      expect(mockPermissionsQuery.select).not.toHaveBeenCalled();
    });
  });

  // ─── hasRole / hasAnyRole ──────────────────────────────────────────────

  describe('hasRole', () => {
    const user: UserContext = {
      id: 'u1',
      email: 'u@e.com',
      role: Role.EDITOR,
      roles: [Role.EDITOR, Role.USER],
      permissions: [],
    };

    it('should return true for a matching role', () => {
      expect(service.hasRole(user, Role.EDITOR)).toBe(true);
    });

    it('should return false for a non-matching role', () => {
      expect(service.hasRole(user, Role.ADMIN)).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    const user: UserContext = {
      id: 'u1',
      email: 'u@e.com',
      role: Role.EDITOR,
      roles: [Role.EDITOR],
      permissions: [],
    };

    it('should return true when at least one role matches', () => {
      expect(service.hasAnyRole(user, [Role.ADMIN, Role.EDITOR])).toBe(true);
    });

    it('should return false when no roles match', () => {
      expect(service.hasAnyRole(user, [Role.ADMIN, Role.SUPER_ADMIN])).toBe(
        false,
      );
    });
  });

  // ─── hasPermission / hasAllPermissions ─────────────────────────────────

  describe('hasPermission', () => {
    it('should return true when the permission is present', () => {
      const user: UserContext = {
        id: 'u1',
        email: 'u@e.com',
        role: Role.EDITOR,
        roles: [Role.EDITOR],
        permissions: ['story.create', 'story.read'],
      };
      expect(service.hasPermission(user, 'story.create')).toBe(true);
    });

    it('should return false when the permission is absent', () => {
      const user: UserContext = {
        id: 'u1',
        email: 'u@e.com',
        role: Role.EDITOR,
        roles: [Role.EDITOR],
        permissions: ['story.read'],
      };
      expect(service.hasPermission(user, 'story.create')).toBe(false);
    });

    it('should return true for admin regardless of permissions list', () => {
      const admin: UserContext = {
        id: 'a1',
        email: 'admin@e.com',
        role: Role.ADMIN,
        roles: [Role.ADMIN],
        permissions: [],
      };
      expect(service.hasPermission(admin, 'anything.here')).toBe(true);
    });

    it('should return true for super_admin regardless of permissions list', () => {
      const superAdmin: UserContext = {
        id: 'sa1',
        email: 'sa@e.com',
        role: Role.SUPER_ADMIN,
        roles: [Role.SUPER_ADMIN],
        permissions: [],
      };
      expect(service.hasPermission(superAdmin, 'user.manage')).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all permissions are present', () => {
      const user: UserContext = {
        id: 'u1',
        email: 'u@e.com',
        role: Role.EDITOR,
        roles: [Role.EDITOR],
        permissions: ['story.create', 'story.read', 'story.update'],
      };
      expect(
        service.hasAllPermissions(user, ['story.create', 'story.read']),
      ).toBe(true);
    });

    it('should return false when some permissions are missing', () => {
      const user: UserContext = {
        id: 'u1',
        email: 'u@e.com',
        role: Role.EDITOR,
        roles: [Role.EDITOR],
        permissions: ['story.read'],
      };
      expect(
        service.hasAllPermissions(user, ['story.create', 'story.read']),
      ).toBe(false);
    });

    it('should return true for admin regardless', () => {
      const admin: UserContext = {
        id: 'a1',
        email: 'admin@e.com',
        role: Role.ADMIN,
        roles: [Role.ADMIN],
        permissions: [],
      };
      expect(
        service.hasAllPermissions(admin, ['story.create', 'billing.manage']),
      ).toBe(true);
    });
  });
});
