import { apiClient } from './client';
import { supabase } from '@/integrations/supabase/client';

/**
 * Backend Core (NestJS) accepts a Supabase access token as a Bearer header
 * (see backend-core AuthGuard). The token is never logged or persisted here.
 */
export const authHeaders = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Story lifecycle statuses as defined by backend-core StoryStatus enum. */
export type BackendStoryStatus =
  | 'draft'
  | 'queued'
  | 'generating'
  | 'generated'
  | 'illustrating'
  | 'narrating'
  | 'completed'
  | 'failed';

export const TERMINAL_SUCCESS_STATUSES: BackendStoryStatus[] = ['generated', 'completed'];
export const TERMINAL_FAILURE_STATUSES: BackendStoryStatus[] = ['failed'];

export interface CreateStoryRequestDto {
  childId: string;
  theme: string;
  selGoal: string;
  language: string;
  readingLevel?: string;
  preferences?: Record<string, unknown>;
}

export interface StoryResponseDto {
  id: string;
  userId?: string;
  childId: string;
  status: BackendStoryStatus | string;
  /** Non-identity request fields (theme, selGoal, language, readingLevel, ...) */
  metadata?: Record<string, unknown>;
  /** Legacy flat fields kept for existing consumers (parent dashboard). */
  theme?: string;
  selGoal?: string;
  language?: string;
  readingLevel?: string;
  preferences?: Record<string, unknown>;
  title?: string;
  pages?: Array<{ pageNumber: number; text: string; [k: string]: unknown }>;
  createdAt: string;
  updatedAt: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  audioReference?: string;
  illustrationUrl?: string;
}

export interface GeneratedStoryData {
  title: string;
  pages: StoryPage[];
  metadata?: Record<string, unknown>;
}

export type FullStoryResponseDto = StoryResponseDto;

export const storiesApi = {
  createStory: async (data: CreateStoryRequestDto) => {
    return apiClient<StoryResponseDto>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: await authHeaders(),
    });
  },

  planStory: async (data: CreateStoryRequestDto) => {
    return apiClient<Record<string, unknown>>('/stories/plan', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: await authHeaders(),
    });
  },

  getUserStories: async () => {
    return apiClient<StoryResponseDto[]>('/stories', { headers: await authHeaders() });
  },

  getStoriesByChild: async (childId: string) => {
    return apiClient<StoryResponseDto[]>(`/stories/child/${childId}`, {
      headers: await authHeaders(),
    });
  },

  getStoryById: async (id: string) => {
    return apiClient<StoryResponseDto>(`/stories/${id}`, { headers: await authHeaders() });
  },

  getStoryStatus: (id: string) => {
    return apiClient<{ status: string; id: string }>(`/stories/${id}/status`);
  },

  updateStoryStatus: (id: string, status: string) => {
    return apiClient<StoryResponseDto>(`/stories/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteStory: (id: string) => {
    return apiClient<void>(`/stories/${id}`, {
      method: 'DELETE',
    });
  },

  retryStory: (id: string) => {
    return apiClient<StoryResponseDto>(`/stories/${id}/retry`, {
      method: 'POST',
    });
  },
};

export class StoryGenerationFailedError extends Error {
  constructor(public storyId: string, message = 'Story generation failed') {
    super(message);
    this.name = 'StoryGenerationFailedError';
  }
}

/**
 * Polls `GET /api/v2/stories/:id` until the story reaches a terminal status.
 * Success: `generated` | `completed`. Failure: `failed`.
 */
export const pollStoryUntilTerminal = async (
  story: StoryResponseDto,
  { intervalMs = 3000, timeoutMs = 300000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<StoryResponseDto> => {
  const deadline = Date.now() + timeoutMs;
  let current = story;
  for (;;) {
    const status = current.status as BackendStoryStatus;
    if (TERMINAL_SUCCESS_STATUSES.includes(status)) return current;
    if (TERMINAL_FAILURE_STATUSES.includes(status)) {
      throw new StoryGenerationFailedError(current.id);
    }
    if (Date.now() >= deadline) {
      throw new Error('Story generation timed out');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    current = await storiesApi.getStoryById(current.id);
  }
};
