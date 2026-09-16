// Canonical Backend Core export contract (V6R2).
// PDF/AUDIO/ZIP exports for authenticated, canonical stories are produced by
// Backend Core so the illustrated PDF can wait for the story-media worker.
// No browser-side PDF generation is used for these stories.
import { axiosInstance } from './client';

export interface CanonicalExportResponse {
  status?: string;
  download_url?: string;
  filename?: string;
  progress?: { completed: number; total: number };
}

export class CanonicalExportError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CanonicalExportError';
  }
}

const request = async (path: string): Promise<CanonicalExportResponse> => {
  const response = await axiosInstance.post<CanonicalExportResponse>(path);
  return (response.data ?? {}) as CanonicalExportResponse;
};

export const exportCanonicalStoryPdf = (storyId: string) =>
  request(`/stories/${storyId}/export/pdf`);

export const exportCanonicalStoryAudio = (storyId: string) =>
  request(`/stories/${storyId}/export/audio`);

export const exportCanonicalStoryZip = (storyId: string) =>
  request(`/stories/${storyId}/export/zip`);

/**
 * Requests the illustrated PDF and waits while Backend Core reports
 * `WAITING_FOR_ILLUSTRATIONS`, so the delivered file contains the finished
 * illustrations produced by the story-media worker.
 */
export const waitForCanonicalStoryPdf = async (
  storyId: string,
  {
    intervalMs = 4000,
    timeoutMs = 180000,
    onProgress,
  }: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (progress: { completed: number; total: number }) => void;
  } = {},
): Promise<CanonicalExportResponse> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await exportCanonicalStoryPdf(storyId);
    if (result.download_url) return result;
    if (result.status !== 'WAITING_FOR_ILLUSTRATIONS') {
      throw new CanonicalExportError(result.status ?? 'pdf_export_failed');
    }
    onProgress?.(result.progress ?? { completed: 0, total: 0 });
    if (Date.now() >= deadline) {
      throw new CanonicalExportError('pdf_waiting_for_illustrations');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};
