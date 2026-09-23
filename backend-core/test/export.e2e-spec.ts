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
import { IllustratedStoryExportService } from '../src/modules/media/export/illustrated-story-export.service.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('TXT / MP3 Export Capability (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let exportService: IllustratedStoryExportService;

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
    exportService = moduleFixture.get<IllustratedStoryExportService>(IllustratedStoryExportService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Unauthenticated Access (401)', () => {
    it('GET /api/v2/stories/story-123/export/txt returns 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v2/stories/story-123/export/txt',
      );
      expect(res.status).toBe(401);
    });

    it('GET /api/v2/stories/story-123/export/audio returns 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v2/stories/story-123/export/audio',
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Non-Owner Fail-Closed Access (404)', () => {
    it('GET /api/v2/stories/unowned-story/export/txt returns 404', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValueOnce({
        id: 'user-unowned-123',
        email: 'other@example.com',
      } as any);

      jest
        .spyOn(exportService, 'exportStoryTxt')
        .mockRejectedValueOnce(
          new (require('@nestjs/common').NotFoundException)('Story not found'),
        );

      const res = await request(app.getHttpServer())
        .get('/api/v2/stories/unowned-story/export/txt')
        .set('Authorization', 'Bearer token-unowned');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Story not found');
    });
  });

  describe('Authenticated Owner Export Access (200)', () => {
    it('POST /api/v2/stories/story-123/export/txt returns 201 with formatted UTF-8 text', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValue({
        id: 'user-owner-123',
        email: 'owner@example.com',
      } as any);

      jest.spyOn(exportService, 'exportStoryTxt').mockResolvedValue({
        status: 'COMPLETED',
        content: 'رحلة إلى القمر\n========================================\n\n[Page 1]\nفي قديم الزمان...',
        filename: 'رحلة_إلى_القمر.txt',
        download_url: 'https://example.com/exports/story-123.txt',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v2/stories/story-123/export/txt')
        .set('Authorization', 'Bearer owner-token');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.filename).toContain('.txt');
      expect(res.body.content).toContain('رحلة إلى القمر');
    });

    it('GET /api/v2/stories/story-123/export/audio returns 200 with MP3 download URL', async () => {
      jest.spyOn(supabaseService, 'verifyToken').mockResolvedValue({
        id: 'user-owner-123',
        email: 'owner@example.com',
      } as any);

      jest.spyOn(exportService, 'exportStoryAudio').mockResolvedValue({
        status: 'COMPLETED',
        download_url: 'https://example.com/audio/story-123.mp3',
        filename: 'The_Brave_Astronaut.mp3',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v2/stories/story-123/export/audio')
        .set('Authorization', 'Bearer owner-token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.download_url).toBe('https://example.com/audio/story-123.mp3');
      expect(res.body.filename).toBe('The_Brave_Astronaut.mp3');
    });
  });
});
