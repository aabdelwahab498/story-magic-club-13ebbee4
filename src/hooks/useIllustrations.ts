import { useQuery } from '@tanstack/react-query';
import { fetchIllustrations, IllustrationJobResponse } from '../api/illustrations.api';

export const useIllustrations = (storyId: string) => {
  return useQuery<IllustrationJobResponse>({
    queryKey: ['illustrations', storyId],
    queryFn: () => fetchIllustrations(storyId),
    enabled: !!storyId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isGenerating = ['PENDING', 'PROCESSING', 'GENERATING'].includes(data.jobStatus);
      return isGenerating ? 3000 : false;
    },
  });
};
