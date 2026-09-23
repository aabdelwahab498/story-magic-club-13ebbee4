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
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { Role } from '../src/modules/rbac/enums/role.enum.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Auth & Identity RBAC Contract (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
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
    rbacService = moduleFixture.get<RbacService>(RbacService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Authentication Failures (Fail-Closed)', () => {
    it('GET /api/v2/me without token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app.getHttpServer()).get('/api/v2/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('GET /api/v2/me with malformed token returns 401 UNAUTHENTICATED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v2/me')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Canonical Identity Context (GET /api/v2/me)', () => {
    it('returns full identity & RBAC context when authenticated', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'user-uuid-123',
        email: 'testuser@example.com',
      } as any);

      jest.spyOn(rbacService as any, 'fetchRoles').mockResolvedValueOnce([Role.USER]);
      jest.spyOn(rbacService as any, 'fetchPermissions').mockResolvedValueOnce(['story.create', 'story.read']);

      const res = await request(app.getHttpServer())
        .get('/api/v2/me')
        .set('Authorization', 'Bearer valid-test-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'user-uuid-123',
        email: 'testuser@example.com',
        role: 'user',
        roles: ['user'],
        permissions: ['story.create', 'story.read'],
      });
    });
  });

  describe('RBAC Authorization & Admin Bypass', () => {
    it('GET /api/v2/admin/users rejects standard USER role with 403 FORBIDDEN', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'user-regular-456',
        email: 'regular@example.com',
      } as any);

      jest.spyOn(rbacService as any, 'fetchRoles').mockResolvedValueOnce([Role.USER]);

      const res = await request(app.getHttpServer())
        .get('/api/v2/admin/users')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v2/admin/users allows ADMIN role', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'admin-uuid-789',
        email: 'admin@example.com',
      } as any);

      jest.spyOn(rbacService as any, 'fetchRoles').mockResolvedValueOnce([Role.ADMIN]);

      const res = await request(app.getHttpServer())
        .get('/api/v2/admin/users')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
    });
  });

  describe('Public Endpoint Access', () => {
    it('POST /api/v2/billing/webhook/stripe is accessible without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v2/billing/webhook/stripe')
        .send({ event: 'payment_intent.succeeded' });

      expect([200, 201]).toContain(res.status);
    });

    it('GET /api/v2/health is accessible without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v2/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
