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
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Illustration Read & Status Capability (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let mediaService: MediaService;

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

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v2/media/stories/:id/illustrations', () => {
    it('returns 401 UNAUTHENTICATED when called unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v2/media/stories/story-123/illustrations',
      );
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('returns 404 NOT_FOUND when requesting non-existent or unowned story', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'user-user-456',
        email: 'otheruser@example.com',
      } as any);

      jest
        .spyOn(mediaService as any, 'verifyStoryOwnership')
        .mockRejectedValueOnce(
          new (require('@nestjs/common').NotFoundException)(
            'Story with ID story-unowned not found',
          ),
        );

      const res = await request(app.getHttpServer())
        .get('/api/v2/media/stories/story-unowned/illustrations')
        .set('Authorization', 'Bearer user-user-456-token');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Story with ID story-unowned not found');
    });

    it('returns 200 OK with canonical illustration status payload for story owner', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'user-owner-123',
        email: 'owner@example.com',
      } as any);

      jest
        .spyOn(mediaService as any, 'verifyStoryOwnership')
        .mockResolvedValueOnce(undefined);

      jest.spyOn(mediaService, 'getIllustrations').mockResolvedValueOnce({
        storyId: 'story-123',
        jobStatus: 'COMPLETED',
        totalPages: 2,
        completedPages: 2,
        failedPages: 0,
        illustrations: [
          {
            pageNumber: 1,
            imageUrl: 'https://storage.example.com/illustrations/story-123/page1.png',
            status: 'COMPLETED',
          },
          {
            pageNumber: 2,
            imageUrl: 'https://storage.example.com/illustrations/story-123/page2.png',
            status: 'COMPLETED',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/api/v2/media/stories/story-123/illustrations')
        .set('Authorization', 'Bearer owner-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        storyId: 'story-123',
        jobStatus: 'COMPLETED',
        totalPages: 2,
        completedPages: 2,
        failedPages: 0,
        illustrations: [
          {
            pageNumber: 1,
            imageUrl: 'https://storage.example.com/illustrations/story-123/page1.png',
            status: 'COMPLETED',
          },
          {
            pageNumber: 2,
            imageUrl: 'https://storage.example.com/illustrations/story-123/page2.png',
            status: 'COMPLETED',
          },
        ],
      });
    });
  });
});
