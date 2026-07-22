// src/hooks/useStoryAudio.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAudio, generateAudio, retryAudio, deleteAudio, AudioJobResponse } from '../api/audio.api';
import { toast } from 'sonner';

export const useStoryAudio = (storyId: string) => {
  return useQuery<AudioJobResponse>({
    queryKey: ['story-audio', storyId],
    queryFn: () => fetchAudio(storyId),
    enabled: !!storyId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isGenerating = ['PENDING', 'PROCESSING'].includes(data.status);
      return isGenerating ? 3000 : false;
    },
  });
};

export const useGenerateAudio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => generateAudio(storyId),
    onSuccess: (_, storyId) => {
      qc.invalidateQueries({ queryKey: ['story-audio', storyId] });
      qc.invalidateQueries({ queryKey: ['my_ai_story', storyId] });
      toast.success('Narration generation started 🎧');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start narration generation');
    },
  });
};

export const useRetryAudio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => retryAudio(storyId),
    onSuccess: (_, storyId) => {
      qc.invalidateQueries({ queryKey: ['story-audio', storyId] });
      qc.invalidateQueries({ queryKey: ['my_ai_story', storyId] });
      toast.success('Retrying narration generation 🎧');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to retry narration generation');
    },
  });
};

export const useDeleteAudio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => deleteAudio(storyId),
    onSuccess: (_, storyId) => {
      qc.invalidateQueries({ queryKey: ['story-audio', storyId] });
      qc.invalidateQueries({ queryKey: ['my_ai_story', storyId] });
      toast.success('Narration deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete narration');
    },
  });
};
