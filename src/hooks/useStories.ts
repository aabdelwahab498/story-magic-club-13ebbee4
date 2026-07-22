import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storiesApi, type StoryResponseDto, type FullStoryResponseDto } from '@/api/stories.api';

// Transform StoryResponseDto to the legacy DBStory format
export const mapToDbStory = (dto: StoryResponseDto | FullStoryResponseDto) => {
  return {
    id: dto.id,
    title: { en: dto.theme || "Story", ar: dto.theme || "قصة" },
    description: { en: dto.selGoal || "", ar: dto.selGoal || "" },
    // Full story returns pages inside generatedStory.pages
    content: { 
      en: ('generatedStory' in dto && dto.generatedStory?.pages) ? dto.generatedStory.pages.map(p => p.text).join('\n\n') : "", 
      ar: ('generatedStory' in dto && dto.generatedStory?.pages) ? dto.generatedStory.pages.map(p => p.text).join('\n\n') : "" 
    },
    // We don't have images at the collection level endpoint yet, fake it to null
    image: null,
    age_range: dto.readingLevel || null,
    duration: null,
    gallery: ('generatedStory' in dto && dto.generatedStory?.pages) ? dto.generatedStory.pages.map(p => p.illustrationUrl || '').filter(Boolean) : null,
    created_by: dto.childId,
    author_name: "",
    video_embed_url: null,
    pdf_url: null,
    audio_url: null,
    category: null,
  };
};

export const useUserStories = () => {
  return useQuery({
    queryKey: ['user_stories'],
    queryFn: async () => {
      const data = await storiesApi.getUserStories();
      return data.map(mapToDbStory);
    },
  });
};

export const useChildStories = (childId: string | undefined) => {
  return useQuery({
    queryKey: ['child_stories', childId],
    queryFn: async () => {
      if (!childId) return [];
      const data = await storiesApi.getStoriesByChild(childId);
      return data.map(mapToDbStory);
    },
    enabled: !!childId,
  });
};

export const useStory = (id: string | undefined) => {
  return useQuery({
    queryKey: ['story', id],
    queryFn: async () => {
      if (!id) return null;
      const data = await storiesApi.getStoryById(id);
      return mapToDbStory(data);
    },
    enabled: !!id,
  });
};

export const useDeleteStory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await storiesApi.deleteStory(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_stories'] });
    },
  });
};
