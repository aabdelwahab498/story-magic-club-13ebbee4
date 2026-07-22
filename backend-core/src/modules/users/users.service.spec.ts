import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Language } from './enums/index.js';

describe('UsersService', () => {
  let service: UsersService;

  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockSingle = jest.fn();
  const mockUpdate = jest.fn();
  const mockFrom = jest.fn();
  const mockInsert = jest.fn();
  const mockDelete = jest.fn();

  const mockSupabaseAdminClient = {
    from: mockFrom,
  };

  const mockSupabaseService = {
    getAdminClient: jest.fn().mockReturnValue(mockSupabaseAdminClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset mocks
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      delete: mockDelete,
    });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockEq.mockReturnValue({
      select: mockSelect,
      single: mockSingle,
      eq: mockEq,
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return profile successfully', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'profile-1',
          user_id: 'user-1',
          display_name: 'Test',
          preferred_language: Language.EN,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await service.getProfile('user-1', 'test@example.com');

      expect(result).toBeDefined();
      expect(result.id).toEqual('profile-1');
      expect(result.email).toEqual('test@example.com');
      expect(result.displayName).toEqual('Test');
    });

    it('should throw NotFoundException if PGRST116', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not Found' },
      });

      await expect(
        service.getProfile('user-1', 'test@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on other errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: '500', message: 'DB Error' },
      });

      await expect(
        service.getProfile('user-1', 'test@example.com'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      // Mock getProfile inner call
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'profile-1',
          user_id: 'user-1',
          display_name: 'Old',
          preferred_language: Language.EN,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock update call
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'profile-1',
          user_id: 'user-1',
          display_name: 'New',
          preferred_language: Language.FR,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await service.updateProfile('user-1', 'test@example.com', {
        displayName: 'New',
        language: Language.FR,
      });

      expect(result.displayName).toEqual('New');
      expect(result.language).toEqual(Language.FR);
    });
  });
});
