import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Multilingual = { en?: string; ar?: string; [k: string]: string | undefined };

export interface DbStoryRow {
  id: string;
  title: Multilingual;
  description: Multilingual;
  content: Multilingual;
  image: string | null;
  age_range: string | null;
  duration: string | null;
  gallery: string[] | null;
  created_by: string | null;
  author_name: string | null;
  video_embed_url: string | null;
  pdf_url: string | null;
  audio_url: string | null;
  category: string | null;
}

const STORY_COLUMNS =
  'id, title, description, content, image, age_range, duration, gallery, created_by, video_embed_url, pdf_url, audio_url, category';

const asMultilingual = (v: unknown): Multilingual => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Multilingual;
  if (typeof v === 'string') return { en: v, ar: v };
  return {};
};

/** Normalizes a `stories` row (jsonb columns) into the shape the UI expects. */
export const mapToDbStory = (row: Record<string, unknown>): DbStoryRow => ({
  id: row.id as string,
  title: asMultilingual(row.title),
  description: asMultilingual(row.description),
  content: asMultilingual(row.content),
  image: (row.image as string) ?? null,
  age_range: (row.age_range as string) ?? null,
  duration: (row.duration as string) ?? null,
  gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : null,
  created_by: (row.created_by as string) ?? null,
  author_name: null,
  video_embed_url: (row.video_embed_url as string) ?? null,
  pdf_url: (row.pdf_url as string) ?? null,
  audio_url: (row.audio_url as string) ?? null,
  category: (row.category as string) ?? null,
});

/** Published catalog stories (readable by everyone) plus the user's own rows via RLS. */
export const useUserStories = () =>
  useQuery({
    queryKey: ['user_stories'],
    queryFn: async (): Promise<DbStoryRow[]> => {
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapToDbStory(r as Record<string, unknown>));
    },
  });

export const useChildStories = (childId: string | undefined) =>
  useQuery({
    queryKey: ['child_stories', childId],
    enabled: !!childId,
    queryFn: async (): Promise<DbStoryRow[]> => {
      const { data, error } = await supabase
        .from('ai_story_history')
        .select('id, title, pages, language, created_at, audio_url, video_embed_url')
        .eq('child_profile_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const pages = Array.isArray(r.pages) ? (r.pages as Array<Record<string, unknown>>) : [];
        const text = pages.map((p) => (p.text as string) || (p.content as string) || '').join('\n\n');
        const title = (r.title as string) || 'Story';
        return {
          id: r.id as string,
          title: { en: title, ar: title },
          description: {},
          content: { en: text, ar: text },
          image: (pages[0]?.image_url as string) ?? null,
          age_range: null,
          duration: null,
          gallery: pages.map((p) => (p.image_url as string) || '').filter(Boolean),
          created_by: childId ?? null,
          author_name: null,
          video_embed_url: (r.video_embed_url as string) ?? null,
          pdf_url: null,
          audio_url: (r.audio_url as string) ?? null,
          category: null,
        } satisfies DbStoryRow;
      });
    },
  });

export const useStory = (id: string | undefined) =>
  useQuery({
    queryKey: ['story', id],
    enabled: !!id,
    queryFn: async (): Promise<DbStoryRow | null> => {
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_COLUMNS)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapToDbStory(data as Record<string, unknown>) : null;
    },
  });

export const useDeleteStory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_stories'] });
    },
  });
};
