import { axiosInstance } from './client';
import { supabase } from '@/integrations/supabase/client';

export type IllustrationResponse = {
  pageNumber: number;
  imageUrl: string;
  status: string;
};

export type IllustrationJobResponse = {
  jobStatus: string;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  illustrations: IllustrationResponse[];
};

export interface CreateIllustrationResponse {
  storyId: string;
  status: string;
}

export const generateIllustrations = async (storyId: string): Promise<CreateIllustrationResponse> => {
  const response = await axiosInstance.post<CreateIllustrationResponse>(`/media/stories/${storyId}/illustrations`);
  return response.data;
};

export const retryIllustrations = async (storyId: string): Promise<CreateIllustrationResponse> => {
  const response = await axiosInstance.post<CreateIllustrationResponse>(`/media/stories/${storyId}/illustrations/retry`);
  return response.data;
};

export const regeneratePageIllustration = async (storyId: string, pageNumber: number): Promise<CreateIllustrationResponse> => {
  const response = await axiosInstance.post<CreateIllustrationResponse>(`/media/stories/${storyId}/illustrations/${pageNumber}/regenerate`);
  return response.data;
};

const normalizeStatus = (status: unknown, imageUrl: unknown): string => {
  const s = String(status ?? 'PENDING').toUpperCase();
  if (imageUrl && (s === 'READY' || s === 'SUCCESS' || s === 'DONE')) return 'COMPLETED';
  return s;
};

/**
 * Canonical illustration state — `GET /api/v2/media/stories/:id/illustrations`.
 * Backend V6R2 owns dispatch and the story-media worker writes `story_media`;
 * the frontend only reads and renders. Missing/pending media never throws.
 */
export const fetchIllustrations = async (storyId: string): Promise<IllustrationJobResponse> => {
  const response = await axiosInstance.get<Partial<IllustrationJobResponse>>(
    `/media/stories/${storyId}/illustrations`,
  );
  const body = (response.data ?? {}) as Partial<IllustrationJobResponse> & {
    illustrations?: Array<{ pageNumber?: number; imageUrl?: string | null; status?: string }>;
  };
  const rawPages = Array.isArray(body.illustrations) ? body.illustrations : [];

  const illustrations: IllustrationResponse[] = rawPages.map((p, idx) => ({
    pageNumber: typeof p?.pageNumber === 'number' ? p.pageNumber : idx + 1,
    imageUrl: p?.imageUrl ?? '',
    status: normalizeStatus(p?.status, p?.imageUrl),
  }));

  const completedPages = illustrations.filter((i) => i.status === 'COMPLETED' && !!i.imageUrl).length;
  const failedPages = illustrations.filter((i) => i.status === 'FAILED').length;
  const totalPages =
    typeof body.totalPages === 'number' && body.totalPages > 0 ? body.totalPages : illustrations.length;
  const jobStatus =
    String(body.jobStatus ?? (totalPages === 0 ? 'NONE' : 'GENERATING')).toUpperCase();

  return { jobStatus, totalPages, completedPages, failedPages, illustrations };
};

export type ExportPdfResponse = {
  status?: string;
  download_url?: string;
  progress?: { completed: number; total: number };
};

export const exportIllustratedStoryPdf = async (storyId: string): Promise<ExportPdfResponse> => {
  const response = await axiosInstance.post<ExportPdfResponse>(`/media/stories/${storyId}/export/pdf`);
  return response.data;
};
