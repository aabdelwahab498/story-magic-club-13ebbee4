import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service.js';
import { RequestContext } from '../common/middleware/request-context.js';

describe('SupabaseService', () => {
  let service: SupabaseService;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test-project.supabase.co';
        if (key === 'SUPABASE_ANON_KEY') return 'test-anon-key-1234567890';
        return '';
      }),
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return undefined;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
    service.onModuleInit();
  });

  it('should start without SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(service).toBeDefined();
    expect(service.getClient()).toBeDefined();
    expect(service.hasAdminClient()).toBe(false);
  });

  it('should throw explicit error when getAdminClient is called without service-role key', () => {
    expect(() => service.getAdminClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is not configured in this environment.',
    );
  });

  it('should return a user client with Authorization header when userJwt is provided', () => {
    const userClient = service.getUserClient('my-test-jwt-token');
    expect(userClient).toBeDefined();
  });

  it('should fallback to RequestContext.authToken if userJwt is omitted', () => {
    RequestContext.run(
      { requestId: 'req-1', traceId: 'tr-1', authToken: 'als-jwt-token' },
      () => {
        const userClient = service.getUserClient();
        expect(userClient).toBeDefined();
      },
    );
  });

  it('should initialize adminClient if SUPABASE_SERVICE_ROLE_KEY is present', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key-1234567890';
      return undefined;
    });

    const serviceWithAdmin = new SupabaseService(mockConfigService);
    serviceWithAdmin.onModuleInit();

    expect(serviceWithAdmin.hasAdminClient()).toBe(true);
    expect(serviceWithAdmin.getAdminClient()).toBeDefined();
  });

  describe('verifyToken', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' } as any;

    function createTestJwt(payload: Record<string, any>): string {
      const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
      ).toString('base64');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64');
      return `${header}.${body}.mock-signature`;
    }

    beforeEach(() => {
      jest
        .spyOn(service.getClient().auth, 'getUser')
        .mockImplementation(async (token: string) => {
          return { data: { user: mockUser }, error: null } as any;
        });
    });

    it('should PASS when aud is string "authenticated"', async () => {
      const token = createTestJwt({
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toEqual(mockUser);
    });

    it('should PASS when aud is single-item array ["authenticated"]', async () => {
      const token = createTestJwt({
        aud: ['authenticated'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toEqual(mockUser);
    });

    it('should PASS when aud is multi-item array ["other", "authenticated"]', async () => {
      const token = createTestJwt({
        aud: ['other', 'authenticated'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toEqual(mockUser);
    });

    it('should FAIL when aud is mismatched string "other"', async () => {
      const token = createTestJwt({
        aud: 'other',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toBeNull();
    });

    it('should FAIL when aud is mismatched array ["other"]', async () => {
      const token = createTestJwt({
        aud: ['other'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toBeNull();
    });

    it('should FAIL when token is expired', async () => {
      const token = createTestJwt({
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) - 3600,
      });
      const user = await service.verifyToken(token);
      expect(user).toBeNull();
    });

    it('should FAIL when aud is unexpected type (number/boolean/object)', async () => {
      const tokenNumber = createTestJwt({
        aud: 12345,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await service.verifyToken(tokenNumber)).toBeNull();

      const tokenBool = createTestJwt({
        aud: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await service.verifyToken(tokenBool)).toBeNull();

      const tokenObj = createTestJwt({
        aud: { role: 'authenticated' },
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await service.verifyToken(tokenObj)).toBeNull();
    });

    it('should enforce issuer check when JWT_ISSUER is configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ISSUER')
          return 'https://test-project.supabase.co/auth/v1';
        return undefined;
      });

      const validIssToken = createTestJwt({
        aud: 'authenticated',
        iss: 'https://test-project.supabase.co/auth/v1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await service.verifyToken(validIssToken)).toEqual(mockUser);

      const invalidIssToken = createTestJwt({
        aud: 'authenticated',
        iss: 'https://wrong-issuer.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(await service.verifyToken(invalidIssToken)).toBeNull();
    });
  });
});
