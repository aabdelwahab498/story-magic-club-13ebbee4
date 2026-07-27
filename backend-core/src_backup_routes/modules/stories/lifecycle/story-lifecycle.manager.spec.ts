/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { StoryLifecycleManager } from './story-lifecycle.manager.js';
import { StoriesService } from '../stories.service.js';
import { StoryLifecycleLogger } from './story-lifecycle.logger.js';
import { StoryLifecycleEvents } from './story-lifecycle.events.js';
import { StoryStatus } from '../enums/story-status.enum.js';
import { InvalidStatusTransitionException } from './exceptions/invalid-transition.exception.js';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { Role } from '../../rbac/enums/role.enum.js';

describe('StoryLifecycleManager', () => {
  let manager: StoryLifecycleManager;
  let storiesService: jest.Mocked<StoriesService>;
  let logger: jest.Mocked<StoryLifecycleLogger>;
  let events: jest.Mocked<StoryLifecycleEvents>;

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
      updateStoryStatus: jest.fn(),
      getStoryById: jest.fn().mockResolvedValue({ childId: 'child-1' }),
    } as unknown as jest.Mocked<StoriesService>;

    logger = {
      logTransition: jest.fn(),
      logFailure: jest.fn(),
      logProgress: jest.fn(),
    } as unknown as jest.Mocked<StoryLifecycleLogger>;

    events = {
      emitQueued: jest.fn(),
      emitGenerationStarted: jest.fn(),
      emitGenerationCompleted: jest.fn(),
      emitGenerationFailed: jest.fn(),
    } as unknown as jest.Mocked<StoryLifecycleEvents>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryLifecycleManager,
        { provide: StoriesService, useValue: storiesService },
        { provide: StoryLifecycleLogger, useValue: logger },
        { provide: StoryLifecycleEvents, useValue: events },
      ],
    }).compile();

    manager = module.get<StoryLifecycleManager>(StoryLifecycleManager);
  });

  describe('transitionStatus', () => {
    it('should transition successfully from DRAFT to QUEUED and emit event', async () => {
      await manager.transitionStatus(
        mockUser,
        mockRequestId,
        StoryStatus.DRAFT,
        StoryStatus.QUEUED,
      );

      expect(storiesService.updateStoryStatus).toHaveBeenCalledWith(
        mockUser,
        mockRequestId,
        StoryStatus.QUEUED,
      );
      expect(events.emitQueued).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: mockRequestId,
          status: StoryStatus.QUEUED,
        }),
      );
      expect(logger.logTransition).toHaveBeenCalled();
    });

    it('should transition successfully from QUEUED to GENERATING', async () => {
      await manager.transitionStatus(
        mockUser,
        mockRequestId,
        StoryStatus.QUEUED,
        StoryStatus.GENERATING,
      );
      expect(events.emitGenerationStarted).toHaveBeenCalled();
    });

    it('should transition successfully from GENERATING to FAILED', async () => {
      await manager.transitionStatus(
        mockUser,
        mockRequestId,
        StoryStatus.GENERATING,
        StoryStatus.FAILED,
      );
      expect(events.emitGenerationFailed).toHaveBeenCalled();
    });

    it('should throw InvalidStatusTransitionException for invalid transition', async () => {
      await expect(
        manager.transitionStatus(
          mockUser,
          mockRequestId,
          StoryStatus.GENERATED,
          StoryStatus.DRAFT,
        ),
      ).rejects.toThrow(InvalidStatusTransitionException);

      expect(storiesService.updateStoryStatus).not.toHaveBeenCalled();
    });
  });

  describe('recordFailure', () => {
    it('should record failure and log it', () => {
      const error = new Error('Test Error');
      const failure = manager.recordFailure(
        mockUser,
        mockRequestId,
        'child-1',
        'planner',
        error,
      );

      expect(failure.stage).toBe('planner');
      expect(logger.logFailure).toHaveBeenCalledWith(
        mockRequestId,
        mockUser.id,
        'child-1',
        'planner',
        error,
      );
    });
  });

  describe('updateProgress', () => {
    it('should log progress', () => {
      manager.updateProgress(mockUser, mockRequestId, 'child-1', 'planner', 50);
      expect(logger.logProgress).toHaveBeenCalledWith(
        mockRequestId,
        mockUser.id,
        'child-1',
        'planner',
        50,
      );
    });
  });
});
