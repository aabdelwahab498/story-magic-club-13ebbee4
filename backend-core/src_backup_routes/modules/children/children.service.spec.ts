import { Test, TestingModule } from '@nestjs/testing';
import { ChildrenService } from './children.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Language } from '../users/enums/index.js';

describe('ChildrenService', () => {
  let service: ChildrenService;

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
        ChildrenService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ChildrenService>(ChildrenService);

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

  describe('child profiles', () => {
    it('should get children', async () => {
      mockEq.mockResolvedValueOnce({ data: [{ id: 'child-1' }], error: null });
      const res = await service.getChildren('user-1');
      expect(res.length).toBe(1);
    });

    it('should get child', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'child-1' },
        error: null,
      });
      const res = await service.getChild('user-1', 'child-1');
      expect(res.id).toBe('child-1');
    });

    it('should create child', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'child-1' },
        error: null,
      });
      const res = await service.createChild('user-1', {
        name: 'C',
        age: 5,
        language: Language.EN,
        interests: [],
        emotionalGoals: [],
        readingLevel: 'BEGINNER' as any,
      });
      expect(res.id).toBe('child-1');
    });

    it('should update child', async () => {
      // Mock fetch
      mockSingle.mockResolvedValueOnce({
        data: { bedtime_preferences: {} },
        error: null,
      });
      // Mock update
      mockSingle.mockResolvedValueOnce({
        data: { id: 'child-1', name: 'D' },
        error: null,
      });
      const res = await service.updateChild('user-1', 'child-1', {
        name: 'D',
        interests: ['Reading'],
      });
      expect(res.name).toBe('D');
    });

    it('should delete child', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'child-1' },
        error: null,
      });
      await service.deleteChild('user-1', 'child-1');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle 404 for getChild', async () => {
      mockSingle.mockResolvedValueOnce({ error: { code: 'PGRST116' } });
      await expect(service.getChild('user-1', 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle 500 for getChild', async () => {
      mockSingle.mockResolvedValueOnce({ error: { message: 'DB Error' } });
      await expect(service.getChild('user-1', 'child-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle 404 for updateChild', async () => {
      mockSingle.mockResolvedValueOnce({ error: { code: 'PGRST116' } });
      await expect(
        service.updateChild('user-1', 'child-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle 500 for updateChild', async () => {
      // Mock fetch
      mockSingle.mockResolvedValueOnce({
        data: { bedtime_preferences: {} },
        error: null,
      });
      // Mock update error
      mockSingle.mockResolvedValueOnce({ error: { message: 'DB Error' } });
      await expect(
        service.updateChild('user-1', 'child-1', {}),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle 404 for deleteChild', async () => {
      mockSingle.mockResolvedValueOnce({ error: { code: 'PGRST116' } });
      await expect(service.deleteChild('user-1', 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle 500 for deleteChild', async () => {
      mockSingle.mockResolvedValueOnce({ error: { message: 'DB Error' } });
      await expect(service.deleteChild('user-1', 'child-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
