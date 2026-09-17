import { StoryGenerationJobHandler } from './story-generation.job-handler.js';
import { AIProviderUnavailableException } from '../../ai/exceptions/ai.exceptions.js';
import type { StoryGenerationOrchestrator } from '../../ai/orchestrator/story-generation.orchestrator.js';
import type { UserContext } from '../../rbac/interfaces/user-context.interface.js';

const user = { id: 'user-1' } as UserContext;

const unavailable = () =>
  new AIProviderUnavailableException('Gemini unavailable after 4 attempts', {
    provider: 'gemini',
    operation: 'story',
    attempts: 4,
    httpStatus: 503,
    errorCategory: 'RETRYABLE_TRANSIENT',
  });

describe('StoryGenerationJobHandler — transient provider outage', () => {
  it('propagates the retryable provider outage instead of a generic job failure', async () => {
    const generateStory = jest.fn().mockRejectedValue(unavailable());
    const handler = new StoryGenerationJobHandler({
      generateStory,
    } as unknown as StoryGenerationOrchestrator);

    await expect(
      handler.handle({
        type: 'story-generation',
        data: { user, requestId: 'req-1' },
      }),
    ).rejects.toBeInstanceOf(AIProviderUnavailableException);

    // Idempotency: the request is attempted exactly once per job execution,
    // so nothing is persisted, dispatched or charged twice.
    expect(generateStory).toHaveBeenCalledTimes(1);
    expect(generateStory).toHaveBeenCalledWith(user, 'req-1');
  });

  it('still reports ordinary failures as a failed job result', async () => {
    const handler = new StoryGenerationJobHandler({
      generateStory: jest.fn().mockRejectedValue(new Error('validation failed')),
    } as unknown as StoryGenerationOrchestrator);

    const result = await handler.handle({
      type: 'story-generation',
      data: { user, requestId: 'req-2' },
    });

    expect(result).toMatchObject({ success: false, error: 'validation failed' });
  });
});
