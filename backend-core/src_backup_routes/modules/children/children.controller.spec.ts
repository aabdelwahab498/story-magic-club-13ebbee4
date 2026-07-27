import { Test, TestingModule } from '@nestjs/testing';
import { ChildrenController } from './children.controller.js';
import { ChildrenService } from './children.service.js';

describe('ChildrenController', () => {
  let controller: ChildrenController;

  const mockChildrenService = {
    getChildren: jest.fn(),
    getChild: jest.fn(),
    createChild: jest.fn(),
    updateChild: jest.fn(),
    deleteChild: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChildrenController],
      providers: [
        {
          provide: ChildrenService,
          useValue: mockChildrenService,
        },
      ],
    }).compile();

    controller = module.get<ChildrenController>(ChildrenController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
