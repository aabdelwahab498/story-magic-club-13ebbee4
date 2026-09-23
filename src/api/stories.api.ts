import { apiClient } from './client';

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
  childId: string;
  status: string;
  language: string;
  theme: string;
  selGoal: string;
  readingLevel: string;
  preferences?: Record<string, unknown>;
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

export interface FullStoryResponseDto extends StoryResponseDto {
  generatedStory?: GeneratedStoryData;
}

export const storiesApi = {
  createStory: (data: CreateStoryRequestDto) => {
    return apiClient<StoryResponseDto>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
      timeout: 90000, // 90 second timeout for story creation job submission
    });
  },

  getUserStories: () => {
    return apiClient<StoryResponseDto[]>('/stories');
  },

  getStoriesByChild: (childId: string) => {
    return apiClient<StoryResponseDto[]>(`/stories/child/${childId}`);
  },

  getStoryById: (id: string) => {
    return apiClient<FullStoryResponseDto>(`/stories/${id}`);
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
