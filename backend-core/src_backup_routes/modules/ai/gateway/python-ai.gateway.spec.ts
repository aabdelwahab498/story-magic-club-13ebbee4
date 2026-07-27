/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { PythonAIGateway } from './python-ai.gateway.js';
import { NestJSAIGateway } from './nestjs-ai.gateway.js';
import { ConfigService } from '@nestjs/config';
import { StoryContext } from '@najmah/shared';

import { MetricsService } from '../../metrics/metrics.service.js';

describe('PythonAIGateway', () => {
  let gateway: PythonAIGateway;
  let fallbackGateway: jest.Mocked<NestJSAIGateway>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    fallbackGateway = {
      buildContext: jest.fn(),
      planStory: jest.fn(),
      writeStory: jest.fn(),
      validateStory: jest.fn(),
    } as unknown as jest.Mocked<NestJSAIGateway>;

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:8000'),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PythonAIGateway,
        {
          provide: NestJSAIGateway,
          useValue: fallbackGateway,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: MetricsService,
          useValue: {
            observeAiProviderLatency: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<PythonAIGateway>(PythonAIGateway);

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('planStory', () => {
    it('should call the Python AI service via fetch', async () => {
      const mockContext: StoryContext = {
        targetAge: 5,
        language: 'en',
        theme: 'space',
        selGoal: 'sharing',
        readingLevel: 'beginner',
      };

      const mockPlan = {
        title: 'Space Adventure',
        characters: [],
        conflict: 'Aliens want the same toy',
        resolution: 'They share the toy',
        selGoals: ['sharing'],
        pageCount: 5,
      };

      fallbackGateway.buildContext.mockReturnValue(mockContext);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,

        json: jest.fn().mockResolvedValue(mockPlan),
      });

      const result = await gateway.planStory(
        5,
        'en',
        'space',
        'sharing',
        'beginner',
      );

      expect(fallbackGateway.buildContext).toHaveBeenCalledWith(
        5,
        'en',
        'space',
        'sharing',
        'beginner',
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/ai/story/plan',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockContext),
        },
      );
      expect(result).toEqual(mockPlan);
    });

    it('should throw error if fetch fails', async () => {
      fallbackGateway.buildContext.mockReturnValue({} as StoryContext);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,

        text: jest.fn().mockResolvedValue('Internal Server Error'),
      });

      await expect(
        gateway.planStory(5, 'en', 'space', 'sharing', 'beginner'),
      ).rejects.toThrow(
        'Python AI Service returned 500: Internal Server Error',
      );
    });
  });

  describe('delegated methods', () => {
    it('should delegate writeStory to fallback', async () => {
      await gateway.writeStory(
        {} as unknown as StoryContext,
        {} as unknown as any,
      );
      expect(fallbackGateway.writeStory).toHaveBeenCalled();
    });

    it('should delegate validateStory to fallback', () => {
      gateway.validateStory(
        {} as unknown as any,
        {} as unknown as StoryContext,
      );
      expect(fallbackGateway.validateStory).toHaveBeenCalled();
    });
  });
});
