import { Test, TestingModule } from '@nestjs/testing';
import { PdfExportService } from './pdf.service.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { ConfigService } from '@nestjs/config';

describe('PdfExportService', () => {
  let service: PdfExportService;
  let mockSupabaseClient: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ error: null }),
          createSignedUrl: jest
            .fn()
            .mockResolvedValue({ data: { signedUrl: 'https://example.com/story.pdf' }, error: null }),
        }),
      },
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'EXPORTS_BUCKET') return 'story-pdfs';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfExportService,
        {
          provide: SupabaseService,
          useValue: {
            getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PdfExportService>(PdfExportService);
  });

  it('should upload PDF to story-pdfs bucket and never pdf_exports', async () => {
    const pages = [
      { pageNumber: 1, text: 'Once upon a time in a magical land.' },
    ];
    const metadata = { title: 'Test Story', childName: 'Star' };

    const url = await service.exportStoryPdf('story-123', pages, metadata, 'user-999');

    expect(url).toBe('https://example.com/story.pdf');
    expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('story-pdfs');
    expect(mockSupabaseClient.storage.from).not.toHaveBeenCalledWith('pdf_exports');
  });

  it('should construct upload path as <userId>/<storyId>/<filename>.pdf with first folder matching userId', async () => {
    const storageObj = mockSupabaseClient.storage.from('story-pdfs');
    const pages = [{ pageNumber: 1, text: 'Once upon a time.' }];
    const metadata = { title: 'Story Title' };

    await service.exportStoryPdf('story-123', pages, metadata, 'user-owner-uuid');

    expect(storageObj.upload).toHaveBeenCalled();
    const uploadedPath: string = storageObj.upload.mock.calls[0][0];
    
    // A. PDF upload path format: <userId>/<storyId>/<timestamp>.pdf
    expect(uploadedPath).toMatch(/^user-owner-uuid\/story-123\/\d+\.pdf$/);

    // B. First folder equals authenticated owner userId for RLS validation:
    // auth.uid()::text = (storage.foldername(name))[1]
    const firstFolder = uploadedPath.split('/')[0];
    expect(firstFolder).toBe('user-owner-uuid');

    // C. Signed URL uses the exact uploaded path
    expect(storageObj.createSignedUrl).toHaveBeenCalledWith(uploadedPath, 86400);
  });

  it('should respect custom EXPORTS_BUCKET env variable if configured', async () => {
    mockConfigService.get.mockReturnValue('custom-pdf-bucket');

    const pages = [{ pageNumber: 1, text: 'Hello world.' }];
    await service.exportStoryPdf('story-456', pages, undefined, 'user-owner-uuid');

    expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('custom-pdf-bucket');
    expect(mockSupabaseClient.storage.from).not.toHaveBeenCalledWith('pdf_exports');
  });
});
