import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { Role } from '../src/modules/rbac/enums/role.enum.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Admin Illustration Entitlement Bypass (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let mediaService: MediaService;
  let rbacService: RbacService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    mediaService = moduleFixture.get<MediaService>(MediaService);
    rbacService = moduleFixture.get<RbacService>(RbacService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('allows illustration job creation for Admin on Free tier with zero credits', async () => {
    const adminUserId = 'admin-user-123';
    const storyId = 'story-admin-1';

    // Mock token verification for admin
    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
    } as any);

    // Mock RBAC buildUserContext for admin role
    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
      role: Role.ADMIN,
      roles: [Role.ADMIN],
      permissions: ['*'],
    });

    // Mock mediaService createIllustrationJob
    jest.spyOn(mediaService, 'createIllustrationJob').mockImplementationOnce(async (sId, user) => {
      const isObject = typeof user === 'object';
      const isAdmin = isObject && (user.roles?.includes(Role.ADMIN) || user.role === Role.ADMIN);
      if (!isAdmin) {
        throw new Error('Feature ILLUSTRATION_GENERATION is not enabled for your plan.');
      }
      return { storyId: sId, status: 'GENERATING' };
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v2/media/stories/${storyId}/illustrations`)
      .set('Authorization', 'Bearer dummy-admin-token');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ storyId, status: 'GENERATING' });
  });

  it('blocks non-admin user with missing entitlement on Free tier', async () => {
    const normalUserId = 'normal-user-456';
    const storyId = 'story-normal-1';

    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: normalUserId,
      email: 'user@example.com',
    } as any);

    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: normalUserId,
      email: 'user@example.com',
      role: Role.USER,
      roles: [Role.USER],
      permissions: [],
    });

    jest.spyOn(mediaService, 'createIllustrationJob').mockImplementationOnce(async () => {
      throw new Error('Feature ILLUSTRATION_GENERATION is not enabled for your plan.');
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v2/media/stories/${storyId}/illustrations`)
      .set('Authorization', 'Bearer dummy-user-token');

    expect(res.status).toBe(500);
  });
});
