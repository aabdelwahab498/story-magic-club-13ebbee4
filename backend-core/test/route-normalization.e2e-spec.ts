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

describe('Route Normalization (e2e)', () => {
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
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Canonical Routes (/api/v2/*)', () => {
    it('GET /api/v2/health (Health Probe) should return 200', () => {
      return request(app.getHttpServer())
        .get('/api/v2/health')
        .expect(200);
    });

    it('GET /api/v2/me should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .get('/api/v2/me')
        .expect(401);
    });

    it('GET /api/v2/users/me should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .get('/api/v2/users/me')
        .expect(401);
    });

    it('GET /api/v2/users/me/children should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .get('/api/v2/users/me/children')
        .expect(401);
    });

    it('GET /api/v2/stories should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .get('/api/v2/stories')
        .expect(401);
    });

    it('POST /api/v2/stories/plan should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .post('/api/v2/stories/plan')
        .expect(401);
    });

    it('GET /api/v2/subscriptions/plans should return 200 or non-404 status', async () => {
      const res = await request(app.getHttpServer()).get('/api/v2/subscriptions/plans');
      expect(res.status).not.toBe(404);
    });

    it('POST /api/v2/billing/checkout should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .post('/api/v2/billing/checkout')
        .expect(401);
    });

    it('GET /api/v2/admin/dashboard/overview should return 401 (Auth required, route exists)', () => {
      return request(app.getHttpServer())
        .get('/api/v2/admin/dashboard/overview')
        .expect(401);
    });
  });

  describe('Legacy Duplicated Routes (/api/v2/api/v2/*)', () => {
    it('GET /api/v2/api/v2/stories should return 404 Not Found', () => {
      return request(app.getHttpServer())
        .get('/api/v2/api/v2/stories')
        .expect(404);
    });

    it('GET /api/v2/api/v2/users/me should return 404 Not Found', () => {
      return request(app.getHttpServer())
        .get('/api/v2/api/v2/users/me')
        .expect(404);
    });

    it('GET /api/v2/api/v2/admin/dashboard/overview should return 404 Not Found', () => {
      return request(app.getHttpServer())
        .get('/api/v2/api/v2/admin/dashboard/overview')
        .expect(404);
    });
  });
});
