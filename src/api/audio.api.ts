// src/api/audio.api.ts
import { axiosInstance } from './client';

export interface AudioJobResponse {
  status: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl: string | null;
  error?: string | null;
}

export const generateAudio = async (storyId: string): Promise<{ mediaId: string; status: string }> => {
  const response = await axiosInstance.post<{ mediaId: string; status: string }>(`/media/stories/${storyId}/audio`);
  return response.data;
};

export const fetchAudio = async (storyId: string): Promise<AudioJobResponse> => {
  const response = await axiosInstance.get<AudioJobResponse>(`/media/stories/${storyId}/audio`);
  return response.data;
};

export const retryAudio = async (storyId: string): Promise<{ mediaId: string; status: string }> => {
  const response = await axiosInstance.post<{ mediaId: string; status: string }>(`/media/stories/${storyId}/audio/retry`);
  return response.data;
};

export const deleteAudio = async (storyId: string): Promise<{ success: boolean }> => {
  const response = await axiosInstance.delete<{ success: boolean }>(`/media/stories/${storyId}/audio`);
  return response.data;
};

// Generic TTS call for client-side play/dynamic narrations, migrating away from direct supabase calls
export const synthesizeDynamicTts = async (args: {
  text: string;
  language: string;
  character?: string;
}): Promise<{ audioContent: string }> => {
  // Let's call /media/tts or map to client wrapper
  // For compatibility with the legacy narrate-story return structure
  const response = await axiosInstance.post<{ audioContent: string }>('/media/tts', args);
  return response.data;
};
