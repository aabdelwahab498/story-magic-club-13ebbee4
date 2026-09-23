import { Test, TestingModule } from '@nestjs/testing';
import { StoriesService } from './stories.service.js';
import { StoriesRepository } from './repositories/stories.repository.js';
import { ChildrenAIContextService } from '../children/ai-context/children-ai-context.service.js';
import { ChildrenService } from '../children/children.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { UsageService } from '../usage/usage.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { StoryGenerationOrchestrator } from '../ai/orchestrator/story-generation.orchestrator.js';
import { AI_GATEWAY } from '../ai/gateway/ai-gateway.interface.js';
import { UserContext } from '../rbac/interfaces/user-context.interface.js';
import { Role } from '../rbac/enums/role.enum.js';
import { CREDIT_COSTS, TRANSACTION_TYPES } from '../credits/credits.constants.js';

describe('StoriesService — Admin Story Credit Bypass & Identity', () => {
  let service: StoriesService;
  let creditsService: jest.Mocked<CreditsService>;
  let storiesRepository: jest.Mocked<StoriesRepository>;

  const mockUser: UserContext = {
    id: 'user-normal-1',
    email: 'user@example.com',
    role: Role.USER,
    roles: [Role.USER],
    permissions: [],
  };

  const mockAdmin: UserContext = {
    id: 'user-admin-1',
    email: 'admin@najmah.ai',
    role: Role.ADMIN,
    roles: [Role.ADMIN],
    permissions: ['*'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        {
          provide: StoriesRepository,
          useValue: {
            saveGeneratedStory: jest.fn().mockResolvedValue(undefined),
            createRequest: jest.fn(),
            findByChild: jest.fn(),
            findAllByUser: jest.fn(),
            findById: jest.fn(),
            getFullStory: jest.fn(),
            updateStatus: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: ChildrenAIContextService,
          useValue: {},
        },
        {
          provide: ChildrenService,
          useValue: {},
        },
        {
          provide: CreditsService,
          useValue: {
            getBalance: jest.fn().mockResolvedValue({ balance: 10 }),
            consumeCredits: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UsageService,
          useValue: {
            trackUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SubscriptionsService,
          useValue: {},
        },
        {
          provide: StoryGenerationOrchestrator,
          useValue: {},
        },
        {
          provide: AI_GATEWAY,
          useValue: {},
        },
        {
          provide: 'JobDispatcher',
          useValue: { dispatch: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    creditsService = module.get(CreditsService);
    storiesRepository = module.get(StoriesRepository);
  });

  it('deducts 2 story credits for normal user when saving generated story', async () => {
    const mockStory: any = { title: 'Omar and the Star', pages: [] };

    await service.saveGeneratedStory(mockUser, 'req-1', mockStory);

    expect(storiesRepository.saveGeneratedStory).toHaveBeenCalledWith('user-normal-1', 'req-1', mockStory);
    expect(creditsService.getBalance).toHaveBeenCalledWith('user-normal-1');
    expect(creditsService.consumeCredits).toHaveBeenCalledWith(
      'user-normal-1',
      CREDIT_COSTS.STORY_GENERATION,
      TRANSACTION_TYPES.STORY_GENERATION,
      'req-1',
    );
  });

  it('bypasses story credit deduction for authorized admin when saving generated story', async () => {
    const mockStory: any = { title: 'Omar and the Star', pages: [] };

    await service.saveGeneratedStory(mockAdmin, 'req-2', mockStory);

    expect(storiesRepository.saveGeneratedStory).toHaveBeenCalledWith('user-admin-1', 'req-2', mockStory);
    expect(creditsService.getBalance).not.toHaveBeenCalled();
    expect(creditsService.consumeCredits).not.toHaveBeenCalled();
  });
});
