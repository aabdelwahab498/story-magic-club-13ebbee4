// backend-core/src/modules/media/audio.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AudioController } from './audio.controller.js';
import { AudioService } from './audio.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';

describe('AudioController', () => {
  let controller: AudioController;
  let service: AudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioController],
      providers: [
        {
          provide: AudioService,
          useValue: {
            generateNarration: jest.fn(),
            getNarration: jest.fn(),
            retryNarration: jest.fn(),
            deleteNarration: jest.fn(),
            synthesizeTts: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AudioController>(AudioController);
    service = module.get<AudioService>(AudioService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateNarration', () => {
    it('should delegate to service.generateNarration', async () => {
      const mockResult = { mediaId: '123', status: 'PENDING' };
      jest.spyOn(service, 'generateNarration').mockResolvedValue(mockResult);

      const result = await controller.generateNarration('story-123');

      expect(service.generateNarration).toHaveBeenCalledWith('story-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('getNarration', () => {
    it('should delegate to service.getNarration', async () => {
      const mockResult = { status: 'COMPLETED', audioUrl: 'http://test.com/audio.mp3' };
      jest.spyOn(service, 'getNarration').mockResolvedValue(mockResult);

      const result = await controller.getNarration('story-123');

      expect(service.getNarration).toHaveBeenCalledWith('story-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('retryNarration', () => {
    it('should delegate to service.retryNarration', async () => {
      const mockResult = { mediaId: '123', status: 'PENDING' };
      jest.spyOn(service, 'retryNarration').mockResolvedValue(mockResult);

      const result = await controller.retryNarration('story-123');

      expect(service.retryNarration).toHaveBeenCalledWith('story-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteNarration', () => {
    it('should delegate to service.deleteNarration', async () => {
      const mockResult = { success: true };
      jest.spyOn(service, 'deleteNarration').mockResolvedValue(mockResult);

      const result = await controller.deleteNarration('story-123');

      expect(service.deleteNarration).toHaveBeenCalledWith('story-123');
      expect(result).toEqual(mockResult);
    });
  });

  describe('synthesizeTts', () => {
    it('should delegate to service.synthesizeTts', async () => {
      const mockResult = { audioContent: 'mockBase64' };
      jest.spyOn(service, 'synthesizeTts').mockResolvedValue(mockResult);

      const result = await controller.synthesizeTts({
        text: 'hello',
        language: 'en',
        character: 'narrator',
      });

      expect(service.synthesizeTts).toHaveBeenCalledWith('hello', 'en', 'narrator');
      expect(result).toEqual(mockResult);
    });
  });
});
