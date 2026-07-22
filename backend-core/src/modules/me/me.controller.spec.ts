import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller.js';
import { Role } from '../rbac/enums/role.enum.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';

describe('MeController', () => {
  let controller: MeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
    }).compile();

    controller = module.get<MeController>(MeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should return the full user context', () => {
      const user: UserContext = {
        id: 'user-123',
        email: 'test@example.com',
        role: Role.EDITOR,
        roles: [Role.EDITOR, Role.USER],
        permissions: ['story.create', 'story.read'],
      };

      const result = controller.getMe(user);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'editor',
        roles: ['editor', 'user'],
        permissions: ['story.create', 'story.read'],
      });
    });

    it('should return admin user with empty permissions', () => {
      const admin: UserContext = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: Role.ADMIN,
        roles: [Role.ADMIN],
        permissions: [],
      };

      const result = controller.getMe(admin);

      expect(result).toEqual({
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        roles: ['admin'],
        permissions: [],
      });
    });
  });
});
