import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import type { UpdateProfileDto } from './dto/index.js';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockUser: UserContext = {
    id: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
      };
      mockUsersService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(mockUser);

      expect(result).toEqual(mockProfile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      const dto: UpdateProfileDto = { displayName: 'Updated Name' };
      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Updated Name',
      };
      mockUsersService.updateProfile.mockResolvedValue(mockProfile);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result).toEqual(mockProfile);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        dto,
      );
    });
  });
});
