import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportStoryPdf } from '../lib/selStoryApi';
import { axiosInstance } from '../api/client';

vi.mock('../api/client', () => ({
  axiosInstance: {
    post: vi.fn(),
  },
}));

describe('exportStoryPdf Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return download_url immediately if COMPLETED', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { status: 'COMPLETED', download_url: 'http://test.com/story.pdf' },
    });

    const url = await exportStoryPdf('story-123');
    expect(url).toBe('http://test.com/story.pdf');
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });

  it('should poll when status is WAITING_FOR_ILLUSTRATIONS and resolve when COMPLETED', async () => {
    vi.mocked(axiosInstance.post)
      .mockResolvedValueOnce({
        data: { status: 'WAITING_FOR_ILLUSTRATIONS', progress: { completed: 0, total: 5 } },
      })
      .mockResolvedValueOnce({
        data: { status: 'WAITING_FOR_ILLUSTRATIONS', progress: { completed: 2, total: 5 } },
      })
      .mockResolvedValueOnce({
        data: { status: 'COMPLETED', download_url: 'http://test.com/ready.pdf' },
      });

    const url = await exportStoryPdf('story-123');
    expect(url).toBe('http://test.com/ready.pdf');
    expect(axiosInstance.post).toHaveBeenCalledTimes(3);
  });

  it('should throw error on terminal FAILED status', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { status: 'FAILED', error: 'Illustration generation failed' },
    });

    await expect(exportStoryPdf('story-123')).rejects.toThrow(
      'Illustration generation failed',
    );
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });
});
