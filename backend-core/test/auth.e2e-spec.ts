import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // e2e tests for auth
  // In a real e2e, we'd mock Supabase, or use a test instance.
  // For now, just ensure the routes are mounted and return 401 when missing tokens.
  it('/auth/me (GET) - missing auth header/cookie should return 401', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('/auth/me (GET) - malformed bearer should return 401', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'InvalidToken')
      .expect(401);
  });
});
