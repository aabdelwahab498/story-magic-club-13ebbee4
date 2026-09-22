/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { StoryGenerationOrchestrator } from './story-generation.orchestrator.js';
import { StoriesService } from '../../stories/stories.service.js';
import { ChildrenService } from '../../children/children.service.js';
import { AI_GATEWAY, IAIGateway } from '../gateway/ai-gateway.interface.js';
import { StoryLifecycleManager } from '../../stories/lifecycle/story-lifecycle.manager.js';
import { StoryMetricsService } from '../../stories/lifecycle/story-metrics.service.js';
import { StoryStatus } from '../../stories/enums/story-status.enum.js';
import {
  AIProviderException,
  AIValidationException,
} from '../exceptions/ai.exceptions.js';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { Role } from '../../rbac/enums/role.enum.js';

describe('StoryGenerationOrchestrator', () => {
  let orchestrator: StoryGenerationOrchestrator;
  let storiesService: jest.Mocked<StoriesService>;
  let childrenService: jest.Mocked<ChildrenService>;
  let aiGateway: jest.Mocked<IAIGateway>;
  let lifecycleManager: jest.Mocked<StoryLifecycleManager>;
  let metricsService: jest.Mocked<StoryMetricsService>;

  const mockUser: UserContext = {
    id: 'user-1',
    email: 'test@example.com',
    role: Role.USER,
    roles: [],
    permissions: [],
  };
  const mockRequestId = 'request-1';

  beforeEach(async () => {
    storiesService = {
      getStoryById: jest.fn(),
      updateStoryStatus: jest.fn(),
      saveGeneratedStory: jest.fn(),
    } as unknown as jest.Mocked<StoriesService>;

    childrenService = {
      getChild: jest.fn(),
    } as unknown as jest.Mocked<ChildrenService>;

    aiGateway = {
      buildContext: jest.fn(),
      planStory: jest.fn(),
      writeStory: jest.fn(),
      validateStory: jest.fn(),
    };

    lifecycleManager = {
      transitionStatus: jest.fn(),
      recordFailure: jest.fn(),
      updateProgress: jest.fn(),
    } as unknown as jest.Mocked<StoryLifecycleManager>;

    metricsService = {
      recordGenerationStarted: jest.fn(),
      recordGenerationSuccess: jest.fn(),
      recordGenerationFailure: jest.fn(),
      recordStageDuration: jest.fn(),
    } as unknown as jest.Mocked<StoryMetricsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryGenerationOrchestrator,
        { provide: StoriesService, useValue: storiesService },
        { provide: ChildrenService, useValue: childrenService },
        { provide: AI_GATEWAY, useValue: aiGateway },
        { provide: StoryLifecycleManager, useValue: lifecycleManager },
        { provide: StoryMetricsService, useValue: metricsService },
      ],
    }).compile();

    orchestrator = module.get<StoryGenerationOrchestrator>(
      StoryGenerationOrchestrator,
    );
  });

  it('should execute the pipeline successfully and persist the story', async () => {
    const mockRequest = {
      id: mockRequestId,
      status: StoryStatus.DRAFT,
      childId: 'child-1',
      language: 'en',
      theme: 'space',
      selGoal: 'bravery',
      readingLevel: 'level_1',
      preferences: {},
    };
    const mockChild = { age: 5 };
    const mockContext = { targetAge: 5 };
    const mockBlueprint = { title: 'Blueprint' };
    const mockStory = { title: 'Final Story', pages: [] };

    storiesService.getStoryById.mockResolvedValue(mockRequest as any);
    childrenService.getChild.mockResolvedValue(mockChild as any);
    aiGateway.buildContext.mockReturnValue(mockContext as any);
    aiGateway.planStory.mockResolvedValue(mockBlueprint as any);
    aiGateway.writeStory.mockResolvedValue(mockStory as any);
    aiGateway.validateStory.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    lifecycleManager.transitionStatus.mockResolvedValue(undefined);
    storiesService.saveGeneratedStory.mockResolvedValue(null as any);

    const result = await orchestrator.generateStory(mockUser, mockRequestId);

    expect(result).toBe(mockStory);
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.DRAFT,
      StoryStatus.QUEUED,
    );
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.QUEUED,
      StoryStatus.GENERATING,
    );
    expect(aiGateway.planStory).toHaveBeenCalledWith(
      5,
      'en',
      'space',
      'bravery',
      'level_1',
      undefined,
    );
    expect(aiGateway.writeStory).toHaveBeenCalledWith(
      mockContext,
      mockBlueprint,
    );
    expect(aiGateway.validateStory).toHaveBeenCalledWith(
      mockStory,
      mockContext,
    );
    expect(storiesService.saveGeneratedStory).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      mockStory,
    );
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.GENERATING,
      StoryStatus.GENERATED,
    );
  });

  it('should transition to FAILED if AI provider fails', async () => {
    storiesService.getStoryById.mockResolvedValue({
      childId: 'child-1',
      status: StoryStatus.GENERATING,
    } as any);
    childrenService.getChild.mockResolvedValue({ age: 5 } as any);
    aiGateway.buildContext.mockReturnValue({} as any);
    aiGateway.planStory.mockRejectedValue(
      new AIProviderException('Network fail'),
    );

    await expect(
      orchestrator.generateStory(mockUser, mockRequestId),
    ).rejects.toThrow(AIProviderException);
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.GENERATING,
      StoryStatus.FAILED,
    );
  });
  it('should transition to FAILED if AI provider fails in writer', async () => {
    storiesService.getStoryById.mockResolvedValue({
      childId: 'child-1',
      status: StoryStatus.GENERATING,
    } as any);
    childrenService.getChild.mockResolvedValue({ age: 5 } as any);
    aiGateway.buildContext.mockReturnValue({} as any);
    aiGateway.planStory.mockResolvedValue({} as any);
    aiGateway.writeStory.mockRejectedValue(
      new AIProviderException('Network fail'),
    );

    await expect(
      orchestrator.generateStory(mockUser, mockRequestId),
    ).rejects.toThrow(AIProviderException);
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.GENERATING,
      StoryStatus.FAILED,
    );
  });

  it('should transition to FAILED if validation fails', async () => {
    storiesService.getStoryById.mockResolvedValue({
      childId: 'child-1',
      status: StoryStatus.GENERATING,
    } as any);
    childrenService.getChild.mockResolvedValue({ age: 5 } as any);
    aiGateway.buildContext.mockReturnValue({} as any);
    aiGateway.planStory.mockResolvedValue({} as any);
    aiGateway.writeStory.mockResolvedValue({} as any);
    aiGateway.validateStory.mockReturnValue({
      valid: false,
      errors: ['Bad word'],
      warnings: [],
    });

    await expect(
      orchestrator.generateStory(mockUser, mockRequestId),
    ).rejects.toThrow(AIValidationException);
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.GENERATING,
      StoryStatus.FAILED,
    );
    expect(storiesService.saveGeneratedStory).not.toHaveBeenCalled();
  });

  it('should transition to FAILED if persistence fails', async () => {
    storiesService.getStoryById.mockResolvedValue({
      childId: 'child-1',
      status: StoryStatus.GENERATING,
    } as any);
    childrenService.getChild.mockResolvedValue({ age: 5 } as any);
    aiGateway.buildContext.mockReturnValue({} as any);
    aiGateway.planStory.mockResolvedValue({} as any);
    aiGateway.writeStory.mockResolvedValue({} as any);
    aiGateway.validateStory.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    storiesService.saveGeneratedStory.mockRejectedValue(new Error('DB Error'));

    await expect(
      orchestrator.generateStory(mockUser, mockRequestId),
    ).rejects.toThrow('DB Error');
    expect(lifecycleManager.transitionStatus).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      StoryStatus.GENERATING,
      StoryStatus.FAILED,
    );
  });
});
