import { useMutation, useQuery } from '@tanstack/react-query';
import { storiesApi, CreateStoryRequestDto } from '@/api/stories.api';

export const useCreateStory = () => {
  return useMutation({
    mutationFn: async (data: CreateStoryRequestDto) => {
      return storiesApi.createStory(data);
    },
  });
};

export const useStoryStatus = (storyId: string | null) => {
  return useQuery({
    queryKey: ['story_status', storyId],
    queryFn: async () => {
      if (!storyId) return null;
      return storiesApi.getStoryStatus(storyId);
    },
    enabled: !!storyId,
    // Poll every 3 seconds while the status is PENDING or PROCESSING
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'PROCESSING') {
        return 3000;
      }
      return false;
    },
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
