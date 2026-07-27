import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { CharacterBibleService } from './character/character.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { IllustratedStoryExportService } from './export/illustrated-story-export.service.js';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: {
            createMediaRequest: jest.fn(),
            getMediaForStory: jest.fn(),
            getMediaStatus: jest.fn(),
            createIllustrationJob: jest.fn(),
            getIllustrations: jest.fn(),
          },
        },
        {
          provide: CharacterBibleService,
          useValue: {
            getCharacters: jest.fn(),
            createBible: jest.fn(),
          },
        },
        {
          provide: IllustratedStoryExportService,
          useValue: {
            exportStoryPdf: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMedia', () => {
    it('should call service.createMediaRequest', async () => {
      jest
        .spyOn(service, 'createMediaRequest')
        .mockResolvedValue({ mediaId: '123', status: 'PENDING' });
      const result = await controller.createMedia('story-1', {
        type: 'ILLUSTRATION',
      });
      expect(service.createMediaRequest).toHaveBeenCalledWith(
        'story-1',
        'ILLUSTRATION',
        undefined,
      );
      expect(result).toEqual({ mediaId: '123', status: 'PENDING' });
    });
  });

  describe('getMediaStatus', () => {
    it('should return media status', async () => {
      jest.spyOn(service, 'getMediaStatus').mockResolvedValue({
        status: 'COMPLETED',
        url: 'http://test.com/img.png',
      });
      const result = await controller.getMediaStatus('media-1');
      expect(service.getMediaStatus).toHaveBeenCalledWith('media-1');
      expect(result.status).toEqual('COMPLETED');
    });
  });

  describe('createIllustrationJob', () => {
    it('should call service.createIllustrationJob', async () => {
      jest
        .spyOn(service, 'createIllustrationJob')
        .mockResolvedValue({ storyId: 'story-1', status: 'GENERATING' });

      const mockUser = { id: 'user-1' } as any;
      const result = await controller.createIllustrationJob(
        'story-1',
        mockUser,
      );
      expect(service.createIllustrationJob).toHaveBeenCalledWith(
        'story-1',
        'user-1',
      );
      expect(result).toEqual({ storyId: 'story-1', status: 'GENERATING' });
    });
  });

  describe('getIllustrationsForStory', () => {
    it('should return mapped illustrations', async () => {
      const mockResult = [
        { pageNumber: 1, imageUrl: 'http://img.com', status: 'COMPLETED' },
      ];
      jest.spyOn(service, 'getIllustrations').mockResolvedValue(mockResult);

      const result = await controller.getIllustrationsForStory('story-1');
      expect(service.getIllustrations).toHaveBeenCalledWith('story-1');
      expect(result).toEqual(mockResult);
    });
  });
});
