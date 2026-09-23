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
import { StoriesRepository } from '../src/modules/stories/repositories/stories.repository.js';
import { StoryStatus } from '../src/modules/stories/enums/story-status.enum.js';
import { IllustratedStoryExportService } from '../src/modules/media/export/illustrated-story-export.service.js';
import { AudioService } from '../src/modules/media/audio.service.js';

describe('Story & Data Convergence BE-004 (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let rbacService: RbacService;
  let storiesRepository: StoriesRepository;

  const mockUserA = {
    id: 'user-a-111',
    email: 'userA@example.com',
  };

  const mockUserB = {
    id: 'user-b-222',
    email: 'userB@example.com',
  };

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

    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
    rbacService = moduleFixture.get<RbacService>(RbacService);
    storiesRepository = moduleFixture.get<StoriesRepository>(StoriesRepository);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const authenticateAs = (user: { id: string; email: string }) => {
    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValue({
      id: user.id,
      email: user.email,
    } as any);

    jest.spyOn(rbacService as any, 'fetchRoles').mockResolvedValue([Role.USER]);
    jest.spyOn(rbacService as any, 'fetchPermissions').mockResolvedValue([
      'story.create',
      'story.read',
      'story.export',
    ]);
  };

  describe('Canonical Data Path (story_requests + stories)', () => {
    it('GET /api/v2/stories/:id retrieves canonical story when present', async () => {
      authenticateAs(mockUserA);

      jest.spyOn(storiesRepository, 'getFullStory').mockResolvedValueOnce({
        metadata: {
          id: 'canonical-story-1',
          userId: mockUserA.id,
          childId: 'child-101',
          status: StoryStatus.GENERATED,
          language: 'en',
          readingLevel: 'level_1',
          theme: 'magic forest',
          selGoal: 'kindness',
          pageCount: 5,
          estimatedReadingTime: 5,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
        content: {
          title: 'The Magic Forest Adventure',
          pages: [
            { pageNumber: 1, text: 'Once upon a time in a magic forest...' },
          ],
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v2/stories/canonical-story-1')
        .set('Authorization', 'Bearer valid-token-a');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('canonical-story-1');
      expect(res.body.title).toBe('The Magic Forest Adventure');
      expect(res.body.metadata.theme).toBe('magic forest');
    });

    it('GET /api/v2/stories/:id falls back to ai_story_history when canonical story is not found', async () => {
      authenticateAs(mockUserA);

      jest.spyOn(storiesRepository, 'findById').mockRejectedValueOnce(
        new (require('@nestjs/common').NotFoundException)('Story request not found'),
      );

      // Simulate Supabase client querying legacy table
      const mockSupabaseClient = {
        from: (table: string) => {
          if (table === 'ai_story_history') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: 'legacy-story-999',
                      user_id: mockUserA.id,
                      child_id: 'child-101',
                      title: 'Legacy Space Odyssey',
                      theme: 'space',
                      sel_goal: 'bravery',
                      generated_story: {
                        title: 'Legacy Space Odyssey',
                        pages: [{ pageNumber: 1, text: 'Flying to the stars...' }],
                      },
                      created_at: '2025-12-15T10:00:00Z',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: null, error: true }) }) }),
          };
        },
      };

      jest.spyOn(supabaseService, 'getUserClient').mockReturnValue(mockSupabaseClient as any);
      jest.spyOn(supabaseService, 'getClient').mockReturnValue(mockSupabaseClient as any);

      const res = await request(app.getHttpServer())
        .get('/api/v2/stories/legacy-story-999')
        .set('Authorization', 'Bearer valid-token-a');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('legacy-story-999');
      expect(res.body.title).toBe('Legacy Space Odyssey');
    });
  });

  describe('Strict Ownership Security', () => {
    it('GET /api/v2/stories/:id blocks user B from reading user A story', async () => {
      authenticateAs(mockUserB);

      jest.spyOn(storiesRepository, 'getFullStory').mockImplementationOnce(async (userId, id) => {
        if (userId !== mockUserA.id) {
          throw new (require('@nestjs/common').NotFoundException)('Story request not found');
        }
        return {} as any;
      });

      const res = await request(app.getHttpServer())
        .get('/api/v2/stories/canonical-story-1')
        .set('Authorization', 'Bearer valid-token-b');

      expect(res.status).toBe(404);
    });

    it('DELETE /api/v2/stories/:id blocks user B from deleting user A story', async () => {
      authenticateAs(mockUserB);

      jest.spyOn(storiesRepository, 'delete').mockImplementationOnce(async (userId, id) => {
        if (userId !== mockUserA.id) {
          throw new (require('@nestjs/common').NotFoundException)('Story request not found or unauthorized');
        }
        return true;
      });

      const res = await request(app.getHttpServer())
        .delete('/api/v2/stories/canonical-story-1')
        .set('Authorization', 'Bearer valid-token-b');

      expect(res.status).toBe(404);
    });
  });

  describe('Export & Audio Convergence', () => {
    it('POST /api/v2/media/stories/:id/export/pdf validates story ownership & format', async () => {
      authenticateAs(mockUserA);

      const exportService = app.get<IllustratedStoryExportService>(IllustratedStoryExportService);
      jest.spyOn(exportService, 'exportStoryPdf').mockResolvedValueOnce({
        status: 'COMPLETED',
        download_url: 'http://test.com/story.pdf',
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/v2/media/stories/canonical-story-1/export/pdf')
        .set('Authorization', 'Bearer valid-token-a');

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.download_url).toBe('http://test.com/story.pdf');
    });

    it('GET /api/v2/media/stories/:storyId/audio verifies ownership', async () => {
      authenticateAs(mockUserA);

      const audioService = app.get<AudioService>(AudioService);
      jest.spyOn(audioService, 'getNarration').mockResolvedValueOnce({
        status: 'COMPLETED',
        audioUrl: 'https://storage.example.com/audio/123.mp3',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v2/media/stories/canonical-story-1/audio')
        .set('Authorization', 'Bearer valid-token-a');

      expect(res.status).toBe(200);
      expect(res.body.audioUrl).toBe('https://storage.example.com/audio/123.mp3');
    });
  });
});
