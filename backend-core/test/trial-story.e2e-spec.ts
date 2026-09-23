import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

import { AppModule } from '../src/app.module.js';

describe('TrialStory (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /api/v2/stories/trial (public anonymous trial generation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/trial')
      .send({
        childName: 'Sarah',
        age: 7,
        theme: 'Space Discovery',
        language: 'en',
        selGoal: 'Curiosity',
      })
      .expect(201);

    expect(res.body).toHaveProperty('requestId');
    expect(res.body.teaser).toBe(true);
    expect(res.body).toHaveProperty('title');
    expect(res.body.shownPages).toBeGreaterThanOrEqual(1);
    expect(res.body.shownPages).toBeLessThanOrEqual(3);
    expect(Array.isArray(res.body.pages)).toBe(true);
    expect(res.body.pages.length).toBe(res.body.shownPages);
    expect(res.body).toHaveProperty('sel_outcome');
  });

  it('POST /api/v2/stories/trial (returns 400 on invalid input)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/trial')
      .send({
        childName: 'Too Young',
        age: 1, // Invalid age < 3
        theme: '', // Empty theme
      })
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
  });

  it('POST /api/v2/stories (authenticated route remains protected)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v2/stories')
      .send({
        childId: 'c123',
        theme: 'Dragons',
        selGoal: 'Courage',
        language: 'en',
      })
      .expect(401);

    expect(res.body).toHaveProperty('statusCode', 401);
  });
});
