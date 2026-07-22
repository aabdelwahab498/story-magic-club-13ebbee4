import { axiosInstance } from './client';

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
  const response = await axiosInstance.get<IllustrationJobResponse>(`/media/stories/${storyId}/illustrations`);
  return response.data;
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
