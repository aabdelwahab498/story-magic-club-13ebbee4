import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';

// Ensure test environment variables are populated prior to AppModule import & validation
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('API Contract Stabilization (e2e)', () => {
  let app: INestApplication;

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Error Contract Structure & Codes', () => {
    it('GET /api/v2/me unauthenticated returns machine-readable error envelope', async () => {
      const response = await request(app.getHttpServer()).get('/api/v2/me');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        statusCode: 401,
        error: 'Unauthorized',
        code: 'UNAUTHENTICATED',
      });
      expect(response.body.message).toBeDefined();
      expect(response.body.trace_id).toBeDefined();
      expect(response.body.requestId).toBe(response.body.trace_id);
    });

    it('POST /api/v2/billing/checkout unauthenticated returns 401 error envelope', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v2/billing/checkout')
        .send({ planId: 'plan-1' });
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Core API Routes Auth Guard Contracts', () => {
    const protectedRoutes: Array<{ method: 'get' | 'post' | 'patch'; path: string; payload?: object }> = [
      { method: 'get', path: '/api/v2/me' },
      { method: 'get', path: '/api/v2/users/me' },
      { method: 'patch', path: '/api/v2/users/me', payload: { fullName: 'Test User' } },
      { method: 'get', path: '/api/v2/users/me/children' },
      { method: 'post', path: '/api/v2/users/me/children', payload: { name: 'Child', birthDate: '2020-01-01' } },
      { method: 'get', path: '/api/v2/stories' },
      { method: 'post', path: '/api/v2/stories', payload: { childId: 'c1', theme: 'space', selGoal: 'empathy', language: 'en' } },
      { method: 'get', path: '/api/v2/stories/story-123' },
      { method: 'get', path: '/api/v2/users/me/credits' },
      { method: 'get', path: '/api/v2/users/me/usage' },
      { method: 'get', path: '/api/v2/users/me/subscription' },
      { method: 'post', path: '/api/v2/billing/checkout', payload: { planId: 'plan-basic' } },
    ];

    for (const route of protectedRoutes) {
      it(`${route.method.toUpperCase()} ${route.path} should require authentication (401)`, async () => {
        const req = request(app.getHttpServer())[route.method](route.path);
        if (route.payload) {
          req.send(route.payload);
        }
        const res = await req;
        expect(res.status).toBe(401);
      });
    }
  });

  describe('Public Endpoints Contract', () => {
    it('GET /api/v2/subscriptions/plans should return array of plans (HTTP 200)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v2/subscriptions/plans');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/v2/health should return health status (HTTP 200)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v2/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
