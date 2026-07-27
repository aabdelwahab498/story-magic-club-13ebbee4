import { Test, TestingModule } from '@nestjs/testing';
import { StoriesController } from './stories.controller.js';
import { StoriesService } from './stories.service.js';
import type { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { StoryStatus } from './enums/story-status.enum.js';

import { IllustratedStoryExportService } from '../media/export/illustrated-story-export.service.js';

describe('StoriesController', () => {
  let controller: StoriesController;

  const mockUser: UserContext = {
    id: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  const mockStoriesService = {
    createStory: jest.fn(),
    getStoriesByChild: jest.fn(),
    getUserStories: jest.fn(),
    getStoryById: jest.fn(),
    getFullStoryById: jest.fn(),
    updateStoryStatus: jest.fn(),
    deleteStory: jest.fn(),
    planStory: jest.fn(),
  };

  const mockExportService = {
    exportStoryPdf: jest.fn(),
    exportStoryAudio: jest.fn(),
    exportStoryZip: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoriesController],
      providers: [
        {
          provide: StoriesService,
          useValue: mockStoriesService,
        },
        {
          provide: IllustratedStoryExportService,
          useValue: mockExportService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StoriesController>(StoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createStory', () => {
    it('should call service with dto', async () => {
      const dto = {
        childId: 'c1',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      };
      mockStoriesService.createStory.mockResolvedValueOnce({ id: 'r1' });

      const result = await controller.createStory(mockUser, dto);
      expect(result.id).toBe('r1');
    });
  });

  describe('getStoriesByChild', () => {
    it('should call service with childId', async () => {
      mockStoriesService.getStoriesByChild.mockResolvedValueOnce([
        { id: 's1' },
      ]);

      const result = await controller.getStoriesByChild(mockUser, 'c1');
      expect(result.length).toBe(1);
    });
  });

  describe('getUserStories', () => {
    it('should call service to get all user stories', async () => {
      mockStoriesService.getUserStories.mockResolvedValueOnce([
        { id: 's1' },
        { id: 's2' },
      ]);

      const result = await controller.getUserStories(mockUser);
      expect(result.length).toBe(2);
      expect(mockStoriesService.getUserStories).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getStoryById', () => {
    it('should call service with id and return full story', async () => {
      mockStoriesService.getFullStoryById.mockResolvedValueOnce({
        id: 's1',
        title: 'Story Title',
      });

      const result = await controller.getStoryById(mockUser, 's1');
      expect(result.id).toBe('s1');
      expect(result.title).toBe('Story Title');
    });
  });

  describe('updateStoryStatus', () => {
    it('should call service to update status', async () => {
      mockStoriesService.updateStoryStatus.mockResolvedValueOnce({
        id: 's1',
        status: StoryStatus.GENERATED,
      });

      const result = await controller.updateStoryStatus(mockUser, 's1', {
        status: StoryStatus.GENERATED,
      });
      expect(result.id).toBe('s1');
    });
  });

  describe('deleteStory', () => {
    it('should call service to delete', async () => {
      mockStoriesService.deleteStory.mockResolvedValueOnce(true);

      const result = await controller.deleteStory(mockUser, 's1');
      expect(result).toBe(true);
    });
  });

  describe('planStory', () => {
    it('should call service.planStory with user and dto', async () => {
      const dto = {
        childId: 'c1',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      };
      const mockPlan = { blueprint: { act1: 'intro' } };
      mockStoriesService.planStory.mockResolvedValueOnce(mockPlan);

      const result = await controller.planStory(mockUser, dto);
      expect(result).toEqual(mockPlan);
      expect(mockStoriesService.planStory).toHaveBeenCalledWith(mockUser, dto);
    });
  });
});
