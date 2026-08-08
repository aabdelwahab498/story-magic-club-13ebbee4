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

export const fetchIllustrations = async (storyId: string): Promise<IllustrationJobResponse> => {
  // Runtime source of truth: Supabase `generated_illustrations` (written by the
  // `illustrate-story` Edge Function). No duplicate data is stored elsewhere.
  const { data, error } = await supabase
    .from('generated_illustrations')
    .select('page_index, image_url, status')
    .eq('story_id', storyId)
    .order('page_index', { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const normalizeStatus = (status: string | null, imageUrl: string | null): string => {
    const s = (status ?? 'PENDING').toUpperCase();
    // The `illustrate-story` Edge Function persists 'ready' on success.
    if (imageUrl && (s === 'READY' || s === 'SUCCESS' || s === 'DONE')) return 'COMPLETED';
    return s;
  };

  // page_index is persisted 1-based by the Edge Function; tolerate 0-based rows too.
  const base = rows.some((r) => r.page_index === 0) ? 0 : 1;

  const illustrations: IllustrationResponse[] = rows.map((r) => ({
    pageNumber: (r.page_index ?? base) - base + 1,
    imageUrl: r.image_url ?? '',
    status: normalizeStatus(r.status, r.image_url),
  }));

  const completedPages = illustrations.filter((i) => i.status === 'COMPLETED' && !!i.imageUrl).length;
  const failedPages = illustrations.filter((i) => i.status === 'FAILED').length;
  const totalPages = illustrations.length;
  const jobStatus =
    totalPages === 0
      ? 'NONE'
      : completedPages + failedPages < totalPages
        ? 'GENERATING'
        : failedPages === totalPages
          ? 'FAILED'
          : 'COMPLETED';

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
