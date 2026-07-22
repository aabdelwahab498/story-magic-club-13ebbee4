/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { StoryContextBuilder } from './story-context.builder.js';
import { ChildrenAIContextService } from '../../children/ai-context/children-ai-context.service.js';
import { UserContext } from '../../rbac/interfaces/user-context.interface.js';
import { Role } from '../../rbac/enums/role.enum.js';
import { StoryMetadata } from '../../stories/interfaces/story-metadata.interface.js';
import { StoryStatus } from '../../stories/enums/story-status.enum.js';

describe('StoryContextBuilder', () => {
  let builder: StoryContextBuilder;
  let childrenAiContextService: jest.Mocked<ChildrenAIContextService>;

  beforeEach(async () => {
    childrenAiContextService = {
      buildContext: jest.fn(),
    } as unknown as jest.Mocked<ChildrenAIContextService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryContextBuilder,
        {
          provide: ChildrenAIContextService,
          useValue: childrenAiContextService,
        },
      ],
    }).compile();

    builder = module.get<StoryContextBuilder>(StoryContextBuilder);
  });

  it('should be defined', () => {
    expect(builder).toBeDefined();
  });

  it('should build story context', () => {
    const context = builder.build(
      7,
      'ar',
      'friendship',
      'confidence',
      'level_2',
    );

    expect(context.targetAge).toBe(7);
    expect(context.language).toBe('ar');
    expect(context.theme).toBe('friendship');
    expect(context.selGoal).toBe('confidence');
    expect(context.readingLevel).toBe('level_2');
  });

  it('should build story context from request', async () => {
    const mockUser: UserContext = {
      id: 'user-1',
      email: 'test@example.com',
      role: Role.USER,
      roles: [],
      permissions: [],
    };
    const mockRequest = {
      childId: 'child-1',
      language: 'en',
      theme: 'space',
      selGoal: 'courage',
      readingLevel: 'level_1',
    } as StoryMetadata;

    childrenAiContextService.buildContext.mockResolvedValue({
      age: 6,
    } as any);

    const context = await builder.buildFromRequest(mockUser, mockRequest);

    expect(childrenAiContextService.buildContext).toHaveBeenCalledWith(
      mockUser,
      'child-1',
    );
    expect(context.targetAge).toBe(6);
    expect(context.language).toBe('en');
    expect(context.theme).toBe('space');
    expect(context.selGoal).toBe('courage');
    expect(context.readingLevel).toBe('level_1');
  });
});
