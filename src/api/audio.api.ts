// src/api/audio.api.ts
// CANONICAL SOURCE: Backend Core (`/api/v2/media/stories/:id/audio`), which owns
// narration generation for authenticated stories (BullMQ story-media worker) and
// persists the result. The frontend only requests and reads state — no second
// authenticated audio-generation path.
import { axiosInstance } from './client';

export interface AudioJobResponse {
  status: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl: string | null;
  error?: string | null;
}

const ALLOWED: AudioJobResponse['status'][] = [
  'NONE',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];

const normalize = (body: unknown): AudioJobResponse => {
  const raw = (body ?? {}) as { status?: unknown; audioUrl?: unknown; error?: unknown };
  const status = String(raw.status ?? 'NONE').toUpperCase() as AudioJobResponse['status'];
  const audioUrl = typeof raw.audioUrl === 'string' ? raw.audioUrl : null;
  return {
    status: ALLOWED.includes(status) ? status : audioUrl ? 'COMPLETED' : 'NONE',
    audioUrl,
    error: typeof raw.error === 'string' ? raw.error : null,
  };
};

/** Request full-story narration through the canonical media pipeline. */
export const generateAudio = async (storyId: string): Promise<{ mediaId: string; status: string }> => {
  const { data } = await axiosInstance.post<{ mediaId?: string; status?: string }>(
    `/media/stories/${storyId}/audio`,
  );
  return { mediaId: data?.mediaId ?? storyId, status: String(data?.status ?? 'PENDING') };
};

/** Read the canonical narration state for a story. */
export const fetchAudio = async (storyId: string): Promise<AudioJobResponse> => {
  const { data } = await axiosInstance.get(`/media/stories/${storyId}/audio`);
  return normalize(data);
};

export const retryAudio = async (storyId: string): Promise<{ mediaId: string; status: string }> => {
  const { data } = await axiosInstance.post<{ mediaId?: string; status?: string }>(
    `/media/stories/${storyId}/audio/retry`,
  );
  return { mediaId: data?.mediaId ?? storyId, status: String(data?.status ?? 'PENDING') };
};

export const deleteAudio = async (storyId: string): Promise<{ success: boolean }> => {
  await axiosInstance.delete(`/media/stories/${storyId}/audio`);
  return { success: true };
};

/** One-off TTS for inline playback (canonical `POST /api/v2/media/tts`). */
export const synthesizeDynamicTts = async (args: {
  text: string;
  language: string;
  character?: string;
}): Promise<{ audioContent: string }> => {
  const { data } = await axiosInstance.post<{ audioContent?: string; error?: string }>('/media/tts', {
    text: args.text,
    language: args.language,
    character: args.character ?? '',
  });
  if (!data?.audioContent) throw new Error(data?.error || 'tts_failed');
  return { audioContent: data.audioContent };
};
