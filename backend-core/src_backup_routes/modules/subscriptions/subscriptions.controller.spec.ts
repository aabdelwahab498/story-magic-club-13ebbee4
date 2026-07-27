import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        {
          provide: SubscriptionsService,
          useValue: {
            getUserSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const mockSub = { plan: 'PREMIUM', status: 'ACTIVE', features: [] };
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue(mockSub);

      const result = await controller.getSubscription({ id: 'user-1' } as any);
      expect(result).toEqual(mockSub);
    });
  });

  describe('getFeatures', () => {
    it('should return a boolean map of features', async () => {
      const mockSub = {
        plan: 'FREE',
        status: 'ACTIVE',
        features: ['STORY_GENERATION', 'ILLUSTRATION_GENERATION'],
      };
      jest.spyOn(service, 'getUserSubscription').mockResolvedValue(mockSub);

      const result = await controller.getFeatures({ id: 'user-1' } as any);
      expect(result).toEqual({
        STORY_GENERATION: true,
        ILLUSTRATION_GENERATION: true,
        PDF_EXPORT: false,
        REGENERATE_ILLUSTRATION: false,
      });
    });
  });
});
