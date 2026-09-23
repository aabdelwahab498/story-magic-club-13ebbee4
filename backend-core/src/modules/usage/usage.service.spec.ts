import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from './usage.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';

describe('UsageService', () => {
  let service: UsageService;
  let supabaseMock: any;

  beforeEach(async () => {
    supabaseMock = {
      getUserClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { event_type: 'STORY_CREATED' },
                { event_type: 'ILLUSTRATION_JOB_STARTED' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should format UUID resource_id correctly and not throw on error', async () => {
    const insertMock = jest.fn().mockResolvedValue({
      error: { message: 'new row violates row-level security policy' },
    });
    supabaseMock.getUserClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ insert: insertMock }),
    });

    await expect(
      service.trackUsage('user-1', 'STORY_CREATED', 'non-uuid-job-id', { foo: 'bar' }),
    ).resolves.not.toThrow();

    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      event_type: 'STORY_CREATED',
      resource_id: null,
      metadata: { foo: 'bar', resourceIdString: 'non-uuid-job-id' },
    });
  });
});
