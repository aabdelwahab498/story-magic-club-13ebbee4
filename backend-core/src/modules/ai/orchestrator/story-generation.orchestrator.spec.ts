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
import { MediaService } from '../../media/media.service.js';
import { StoryDirectorService } from '../director/story-director.service.js';
import { StoryGuardianService } from '../director/story-guardian.service.js';

describe('StoryGenerationOrchestrator', () => {
  let orchestrator: StoryGenerationOrchestrator;
  let storiesService: jest.Mocked<StoriesService>;
  let childrenService: jest.Mocked<ChildrenService>;
  let aiGateway: jest.Mocked<IAIGateway>;
  let lifecycleManager: jest.Mocked<StoryLifecycleManager>;
  let metricsService: jest.Mocked<StoryMetricsService>;
  let mediaService: jest.Mocked<MediaService>;

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

    mediaService = {
      createIllustrationJob: jest.fn().mockResolvedValue({ status: 'GENERATING' }),
    } as unknown as jest.Mocked<MediaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryGenerationOrchestrator,
        StoryDirectorService,
        StoryGuardianService,
        { provide: StoriesService, useValue: storiesService },
        { provide: ChildrenService, useValue: childrenService },
        { provide: AI_GATEWAY, useValue: aiGateway },
        { provide: StoryLifecycleManager, useValue: lifecycleManager },
        { provide: StoryMetricsService, useValue: metricsService },
        { provide: MediaService, useValue: mediaService },
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
    };
    const mockChild = { age: 5 };
    const mockContext = { targetAge: 5 };
    const mockBlueprint = { title: 'Blueprint' };
    const mockStory = { title: 'Final Story', pages: [{ pageNumber: 1, text: 'Text' }] };

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
    expect(storiesService.saveGeneratedStory).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      mockStory,
    );
    expect(mediaService.createIllustrationJob).toHaveBeenCalledWith(
      mockRequestId,
      mockUser,
    );
  });

  it('REGRESSION: Omar & Lost Star acceptance brief must be preserved and approved', async () => {
    const omarBrief =
      "Write a warm and exciting children's adventure story about Omar, a curious 7-year-old boy, who discovers a tiny glowing star that has lost its way back to the sky in his garden. Omar decides to help the little star find its way home. Throughout the journey, Omar learns about courage, kindness, helping others, and overcoming fear. In the end, the little star safely returns to the night sky.";

    const mockRequest = {
      id: mockRequestId,
      status: StoryStatus.QUEUED,
      childId: 'child-1',
      language: 'en',
      theme: 'space',
      selGoal: 'courage',
      readingLevel: 'level_2',
      customPrompt: omarBrief,
      childName: 'Omar',
      age: 7,
    };
    const mockContext = { targetAge: 7, customPrompt: omarBrief, childName: 'Omar' };
    const mockBlueprint = { title: 'Omar and the Lost Star', characters: [{ name: 'Omar', role: 'hero' }] };
    const mockStory = {
      title: 'Omar and the Lost Star',
      pages: [
        { pageNumber: 1, text: 'Omar found a tiny glowing star in his garden.' },
        { pageNumber: 2, text: 'Omar helped the glowing star return safely to the night sky.' },
      ],
    };

    storiesService.getStoryById.mockResolvedValue(mockRequest as any);
    childrenService.getChild.mockResolvedValue({ age: 7, name: 'Omar' } as any);
    aiGateway.buildContext.mockReturnValue(mockContext as any);
    aiGateway.planStory.mockResolvedValue(mockBlueprint as any);
    aiGateway.writeStory.mockResolvedValue(mockStory as any);
    aiGateway.validateStory.mockReturnValue({ valid: true, errors: [], warnings: [] });
    storiesService.saveGeneratedStory.mockResolvedValue(null as any);

    const result = await orchestrator.generateStory(mockUser, mockRequestId);

    expect(result.title).toBe('Omar and the Lost Star');
    expect(storiesService.saveGeneratedStory).toHaveBeenCalledWith(
      mockUser,
      mockRequestId,
      mockStory,
    );
  });

  it('REGRESSION: Should REJECT unrelated "Leo\'s Big Backyard Safari" and trigger bounded correction', async () => {
    const omarBrief =
      "Write a warm and exciting children's adventure story about Omar, a curious 7-year-old boy, who discovers a tiny glowing star that has lost its way back to the sky in his garden. Omar decides to help the little star find its way home.";

    const mockRequest = {
      id: mockRequestId,
      status: StoryStatus.QUEUED,
      childId: 'child-1',
      language: 'en',
      theme: 'space',
      selGoal: 'courage',
      readingLevel: 'level_2',
      customPrompt: omarBrief,
      childName: 'Omar',
      age: 7,
    };

    const mockContext = { targetAge: 7, customPrompt: omarBrief, childName: 'Omar' };
    const leoStory = {
      title: "Leo's Big Backyard Safari",
      pages: [{ pageNumber: 1, text: 'Leo and Pip went on a safari in the backyard.' }],
    };

    storiesService.getStoryById.mockResolvedValue(mockRequest as any);
    childrenService.getChild.mockResolvedValue({ age: 7, name: 'Omar' } as any);
    aiGateway.buildContext.mockReturnValue(mockContext as any);
    aiGateway.planStory.mockResolvedValue({ title: 'Blueprint' } as any);
    aiGateway.writeStory.mockResolvedValue(leoStory as any);
    aiGateway.validateStory.mockReturnValue({ valid: false, errors: ['Story Guardian Violation: Unrelated story Leo'], warnings: [] });

    await expect(
      orchestrator.generateStory(mockUser, mockRequestId),
    ).rejects.toThrow(AIValidationException);

    expect(storiesService.saveGeneratedStory).not.toHaveBeenCalled();
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
});
