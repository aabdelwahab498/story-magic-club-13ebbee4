import { useMutation, useQuery } from '@tanstack/react-query';
import {
  storiesApi,
  pollStoryUntilTerminal,
  TERMINAL_FAILURE_STATUSES,
  TERMINAL_SUCCESS_STATUSES,
  type BackendStoryStatus,
  type CreateStoryRequestDto,
  type StoryResponseDto,
} from '@/api/stories.api';

export { pollStoryUntilTerminal };

const isTerminal = (status?: string) =>
  !!status &&
  (TERMINAL_SUCCESS_STATUSES.includes(status as BackendStoryStatus) ||
    TERMINAL_FAILURE_STATUSES.includes(status as BackendStoryStatus));

/** Creates a story through Backend Core (`POST /api/v2/stories`). */
export const useCreateStory = () => {
  return useMutation({
    mutationFn: async (data: CreateStoryRequestDto): Promise<StoryResponseDto> => {
      return storiesApi.createStory(data);
    },
  });
};

/**
 * Polls `GET /api/v2/stories/:id` every 3s while the story is still in a
 * non-terminal lifecycle state (draft/queued/generating/illustrating/narrating).
 */
export const useStoryStatus = (storyId: string | null) => {
  return useQuery({
    queryKey: ['story_status', storyId],
    queryFn: async () => {
      if (!storyId) return null;
      return storiesApi.getStoryById(storyId);
    },
    enabled: !!storyId,
    refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : 3000),
  });
};

export const useFullStory = (storyId: string | null, enabled: boolean) => {
  return useQuery({
    queryKey: ['full_story', storyId],
    queryFn: async () => {
      if (!storyId) return null;
      return storiesApi.getStoryById(storyId);
    },
    enabled: !!storyId && enabled,
  });
};
