import { Test, TestingModule } from '@nestjs/testing';
import { EdgeAudioProvider } from './edge-audio.provider.js';
import { SupabaseService } from '../../../../supabase/supabase.service.js';
import { RequestContext } from '../../../../common/middleware/request-context.js';

describe('EdgeAudioProvider', () => {
  let provider: EdgeAudioProvider;
  let mockInvoke: jest.Mock;

  beforeEach(async () => {
    mockInvoke = jest.fn().mockResolvedValue({
      data: { success: true, audioUrl: 'https://test-bucket.supabase.co/audio.mp3' },
      error: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdgeAudioProvider,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue({
              functions: { invoke: mockInvoke },
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<EdgeAudioProvider>(EdgeAudioProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should forward user JWT in Authorization header when generating audio', async () => {
    await RequestContext.run(
      { requestId: 'req-1', traceId: 'trace-1', userId: 'user-123', authToken: 'jwt-user-token-abc' },
      async () => {
        const url = await provider.generate('story-1', {
          text: 'Hello story',
          language: 'en',
        });

        expect(url).toBe('https://test-bucket.supabase.co/audio.mp3');
        expect(mockInvoke).toHaveBeenCalledWith(
          'narrate-story-edge',
          expect.objectContaining({
            headers: { Authorization: 'Bearer jwt-user-token-abc' },
          }),
        );
      },
    );
  });
});
