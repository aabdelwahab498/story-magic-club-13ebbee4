import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateIllustrations, retryIllustrations, regeneratePageIllustration, exportIllustratedStoryPdf, CreateIllustrationResponse, ExportPdfResponse } from '../api/illustrations.api';

export const useGenerateIllustrations = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateIllustrationResponse, Error, string>({
    mutationFn: (storyId: string) => generateIllustrations(storyId),
    onSuccess: (data, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['illustrations', storyId] });
    },
  });
};

export const useRetryIllustrations = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateIllustrationResponse, Error, string>({
    mutationFn: (storyId: string) => retryIllustrations(storyId),
    onSuccess: (data, storyId) => {
      queryClient.invalidateQueries({ queryKey: ['illustrations', storyId] });
    },
  });
};

export const useRegeneratePageIllustration = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateIllustrationResponse, Error, { storyId: string; pageNumber: number }>({
    mutationFn: ({ storyId, pageNumber }) => regeneratePageIllustration(storyId, pageNumber),
    onSuccess: (data, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: ['illustrations', storyId] });
    },
  });
};

export const useExportIllustratedStory = () => {
  return useMutation<ExportPdfResponse, Error, string>({
    mutationFn: (storyId: string) => exportIllustratedStoryPdf(storyId),
  });
};
