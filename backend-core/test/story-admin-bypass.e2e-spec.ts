import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { StoriesService } from '../src/modules/stories/stories.service.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { Role } from '../src/modules/rbac/enums/role.enum.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Admin Story Quota Bypass (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let storiesService: StoriesService;
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
    storiesService = moduleFixture.get<StoriesService>(StoriesService);
    rbacService = moduleFixture.get<RbacService>(RbacService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('allows /api/v2/stories/plan for Admin on Free plan when quota exhausted', async () => {
    const adminUserId = 'admin-user-789';

    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
    } as any);

    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
      role: Role.ADMIN,
      roles: [Role.ADMIN],
      permissions: ['*'],
    });

    jest.spyOn(storiesService, 'planStory').mockResolvedValueOnce({
      blueprint: { act1: 'Admin Plan' },
    } as any);

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/plan')
      .set('Authorization', 'Bearer dummy-admin-token')
      .send({
        childId: '550e8400-e29b-41d4-a716-446655440000',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ blueprint: { act1: 'Admin Plan' } });
  });

  it('allows /api/v2/stories for Admin on Free plan when quota exhausted', async () => {
    const adminUserId = 'admin-user-789';

    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
    } as any);

    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
      role: Role.ADMIN,
      roles: [Role.ADMIN],
      permissions: ['*'],
    });

    jest.spyOn(storiesService, 'createStory').mockResolvedValueOnce({
      id: 'story-req-admin-1',
      status: 'PENDING',
    } as any);

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories')
      .set('Authorization', 'Bearer dummy-admin-token')
      .send({
        childId: '550e8400-e29b-41d4-a716-446655440000',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('story-req-admin-1');
  });

  it('allows /api/v2/stories/plan for SuperAdmin', async () => {
    const superAdminUserId = 'super-admin-999';

    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: superAdminUserId,
      email: 'superadmin@najmah.ai',
    } as any);

    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: superAdminUserId,
      email: 'superadmin@najmah.ai',
      role: Role.SUPER_ADMIN,
      roles: [Role.SUPER_ADMIN],
      permissions: ['*'],
    });

    jest.spyOn(storiesService, 'planStory').mockResolvedValueOnce({
      blueprint: { act1: 'SuperAdmin Plan' },
    } as any);

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/plan')
      .set('Authorization', 'Bearer dummy-superadmin-token')
      .send({
        childId: '550e8400-e29b-41d4-a716-446655440000',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      });

    expect(res.status).toBe(201);
    expect(res.body.blueprint.act1).toBe('SuperAdmin Plan');
  });

  it('enforces child ownership check even for admin', async () => {
    const adminUserId = 'admin-user-789';

    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
    } as any);

    jest.spyOn(rbacService, 'buildUserContext').mockResolvedValueOnce({
      id: adminUserId,
      email: 'admin@najmah.ai',
      role: Role.ADMIN,
      roles: [Role.ADMIN],
      permissions: ['*'],
    });

    jest.spyOn(storiesService, 'createStory').mockRejectedValueOnce(
      new NotFoundException('Child not found or unauthorized'),
    );

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories')
      .set('Authorization', 'Bearer dummy-admin-token')
      .send({
        childId: '550e8400-e29b-41d4-a716-446655449999',
        theme: 'space',
        selGoal: 'focus',
        language: 'en',
      });

    expect(res.status).toBe(404);
  });
});
