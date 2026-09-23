process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'dummy_google_api_key';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { AI_GATEWAY } from '../src/modules/ai/gateway/ai-gateway.interface.js';
import { Role } from '../src/modules/rbac/enums/role.enum.js';
import { StoryStatus } from '../src/modules/stories/enums/story-status.enum.js';
import { StoriesRepository } from '../src/modules/stories/repositories/stories.repository.js';
import { ChildrenService } from '../src/modules/children/children.service.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { AudioService } from '../src/modules/media/audio.service.js';
import { IllustratedStoryExportService } from '../src/modules/media/export/illustrated-story-export.service.js';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service.js';

describe('V1 Customer Journey End-to-End (e2e)', () => {
  let app: INestApplication;
  let supabaseService: SupabaseService;
  let rbacService: RbacService;
  let storiesRepository: StoriesRepository;
  let childrenService: ChildrenService;
  let mediaService: MediaService;
  let audioService: AudioService;
  let exportService: IllustratedStoryExportService;
  let subscriptionsService: SubscriptionsService;

  const mockUser = {
    id: 'user-customer-v1',
    email: 'parent@example.com',
  };
  const mockJwt = 'mock-jwt-customer-v1';

  beforeAll(async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('fake-image-bytes')),
      });
    }) as any;

    const mockAiGateway = {
      buildContext: jest.fn().mockReturnValue({ language: 'en', age: 6 }),
      planStory: jest.fn().mockResolvedValue({
        title: 'Sami the Dolphin',
        characters: [{ name: 'Sami', role: 'hero' }],
        selOutcome: { skill: 'Bravery', statement: 'Sami proved brave.' },
      }),
      writeStory: jest.fn().mockResolvedValue({
        title: 'Sami the Dolphin',
        pages: [
          { pageNumber: 1, text: 'Sami loved swimming near the coral reef.' },
          { pageNumber: 2, text: 'One day, Sami found a glowing pearl.' },
          { pageNumber: 3, text: 'Sami shared the pearl with friends.' },
        ],
        metadata: { theme: 'Courage', selGoal: 'Bravery' },
      }),
      validateStory: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_GATEWAY)
      .useValue(mockAiGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    supabaseService = app.get(SupabaseService);
    rbacService = app.get(RbacService);
    storiesRepository = app.get(StoriesRepository);
    childrenService = app.get(ChildrenService);
    mediaService = app.get(MediaService);
    audioService = app.get(AudioService);
    exportService = app.get(IllustratedStoryExportService);
    subscriptionsService = app.get(SubscriptionsService);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const authenticate = () => {
    jest.spyOn(supabaseService, 'verifyToken').mockResolvedValue({
      id: mockUser.id,
      email: mockUser.email,
    } as any);

    jest.spyOn(rbacService as any, 'fetchRoles').mockResolvedValue([Role.USER]);
    jest.spyOn(rbacService as any, 'fetchPermissions').mockResolvedValue([
      'story.create',
      'story.read',
      'story.export',
    ]);
  };

  it('1. Parent creates story -> generation lifecycle succeeds', async () => {
    authenticate();

    jest.spyOn(childrenService, 'getChild').mockResolvedValue({
      id: 'child-v1',
      name: 'Sami',
      age: 6,
    } as any);

    jest.spyOn(subscriptionsService, 'getUserSubscription').mockResolvedValue({
      plan: 'free',
      status: 'ACTIVE',
      features: ['STORY_GENERATION', 'ILLUSTRATION_GENERATION', 'PDF_EXPORT', 'AUDIO_NARRATION'],
      limits: { STORIES_PER_MONTH: 30, STORIES_PER_DAY: 3 },
    });

    jest.spyOn(subscriptionsService, 'checkStoryQuota').mockResolvedValue({
      allowed: true,
      tier: 'free',
      daily_used: 1,
      daily_limit: 3,
      monthly_used: 1,
      monthly_limit: 30,
      reason: null,
    });

    jest.spyOn(storiesRepository, 'createRequest').mockResolvedValue({
      id: 'story-v1-journey',
      userId: mockUser.id,
      childId: 'child-v1',
      childName: 'Sami',
      age: 6,
      theme: 'Courage in the Deep Ocean',
      selGoal: 'Bravery',
      language: 'en',
      readingLevel: 'level_1',
      pageCount: 3,
      estimatedReadingTime: 3,
      status: StoryStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest.spyOn(storiesRepository, 'findById').mockResolvedValue({
      id: 'story-v1-journey',
      userId: mockUser.id,
      childId: 'child-v1',
      childName: 'Sami',
      age: 6,
      theme: 'Courage in the Deep Ocean',
      selGoal: 'Bravery',
      language: 'en',
      readingLevel: 'level_1',
      pageCount: 3,
      estimatedReadingTime: 3,
      status: StoryStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest.spyOn(storiesRepository, 'updateStatus').mockResolvedValue({
      id: 'story-v1-journey',
      userId: mockUser.id,
      status: StoryStatus.GENERATED,
    } as any);

    jest.spyOn(storiesRepository, 'saveGeneratedStory').mockResolvedValue(undefined);

    jest.spyOn(storiesRepository, 'getFullStory').mockResolvedValue({
      metadata: {
        id: 'story-v1-journey',
        userId: mockUser.id,
        childId: 'child-v1',
        childName: 'Sami',
        age: 6,
        theme: 'Courage in the Deep Ocean',
        selGoal: 'Bravery',
        language: 'en',
        readingLevel: 'level_1',
        pageCount: 3,
        estimatedReadingTime: 3,
        status: StoryStatus.GENERATED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      content: {
        id: 'story-v1-journey',
        title: 'Sami the Dolphin',
        pages: [
          { pageNumber: 1, text: 'Sami loved swimming near the coral reef.' },
          { pageNumber: 2, text: 'One day, Sami found a glowing pearl.' },
          { pageNumber: 3, text: 'Sami shared the pearl with friends.' },
        ],
        metadata: {
          sel_outcome: { skill: 'Bravery', emotion: 'calm', statement: 'Sami proved brave.' },
          character_visual_hash: 'abc123hash',
          age_band: '6-8',
        },
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories')
      .set('Authorization', `Bearer ${mockJwt}`)
      .send({
        childId: 'child-v1',
        childName: 'Sami',
        age: 6,
        theme: 'Courage in the Deep Ocean',
        selGoal: 'Bravery',
        language: 'en',
        readingLevel: 'level_1',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'story-v1-journey');
    expect(res.body).toHaveProperty('title', 'Sami the Dolphin');
    expect(res.body.pages).toHaveLength(3);
    expect(res.body).toHaveProperty('sel_outcome');
    expect(res.body).toHaveProperty('character_visual_hash');
  });

  it('2. Guest trial story generation remains functional and separate', async () => {
    jest.spyOn(storiesRepository, 'createRequest').mockResolvedValueOnce({
      id: 'trial-story-999',
      userId: 'guest-trial',
      childName: 'Leo',
      age: 5,
      theme: 'Forest Friends',
      selGoal: 'Kindness',
      language: 'en',
      readingLevel: 'level_1',
      pageCount: 3,
      estimatedReadingTime: 3,
      status: StoryStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/trial')
      .send({
        childName: 'Leo',
        age: 5,
        theme: 'Forest Friends',
        selGoal: 'Kindness',
        language: 'en',
      });

    expect(res.status).toBe(201);
    expect(res.body.teaser).toBe(true);
    expect(res.body.pages.length).toBeGreaterThanOrEqual(1);
  });

  it('3. Automatic / Requested illustration read returns completed state', async () => {
    authenticate();

    jest.spyOn(mediaService, 'getIllustrations').mockResolvedValue({
      storyId: 'story-v1-journey',
      status: 'COMPLETED',
      pages: [
        { pageNumber: 1, imageUrl: 'https://example.com/images/p1.jpg', status: 'COMPLETED' },
        { pageNumber: 2, imageUrl: 'https://example.com/images/p2.jpg', status: 'COMPLETED' },
        { pageNumber: 3, imageUrl: 'https://example.com/images/p3.jpg', status: 'COMPLETED' },
      ],
    } as any);

    const res = await request(app.getHttpServer())
      .get('/api/v2/media/stories/story-v1-journey/illustrations')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pages');
    expect(res.body.pages).toHaveLength(3);
  });

  it('4. Audio narration endpoint returns playable audio state', async () => {
    authenticate();

    jest.spyOn(audioService, 'getNarration').mockResolvedValue({
      status: 'COMPLETED',
      audioUrl: 'https://example.com/audio/sami-narration.mp3',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v2/media/stories/story-v1-journey/audio')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'COMPLETED');
    expect(res.body).toHaveProperty('audioUrl', 'https://example.com/audio/sami-narration.mp3');
  });

  it('5. Illustrated PDF export returns completed status with signed download URL', async () => {
    authenticate();

    jest.spyOn(exportService, 'exportStoryPdf').mockResolvedValue({
      status: 'COMPLETED',
      download_url: 'https://example.com/signed/story-v1.pdf',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/story-v1-journey/export/pdf')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body).toHaveProperty('download_url');
    expect(res.body.download_url).toContain('https://example.com/signed/story-v1.pdf');
  });

  it('6. Library / History read model returns canonical user stories', async () => {
    authenticate();

    jest.spyOn(storiesRepository, 'findAllByUser').mockResolvedValue([
      {
        id: 'story-v1-journey',
        userId: mockUser.id,
        childId: 'child-v1',
        theme: 'Courage in the Deep Ocean',
        selGoal: 'Bravery',
        language: 'en',
        readingLevel: 'level_1',
        pageCount: 3,
        estimatedReadingTime: 3,
        status: StoryStatus.GENERATED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v2/stories')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('7. ZIP bundle export returns usable download URL/state', async () => {
    authenticate();

    jest.spyOn(exportService, 'exportStoryZip').mockResolvedValue({
      status: 'COMPLETED',
      download_url: 'https://example.com/signed/story-bundle.zip',
      filename: 'story-bundle.zip',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v2/stories/story-v1-journey/export/zip')
      .set('Authorization', `Bearer ${mockJwt}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body).toHaveProperty('download_url');
    expect(res.body).toHaveProperty('filename', 'story-bundle.zip');
  });
});
