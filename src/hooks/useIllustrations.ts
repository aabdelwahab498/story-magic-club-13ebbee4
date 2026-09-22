import { useQuery } from '@tanstack/react-query';
import { fetchIllustrations, IllustrationJobResponse } from '../api/illustrations.api';
import { supabase } from '@/integrations/supabase/client';

export const useIllustrations = (storyId: string) => {
  return useQuery<IllustrationJobResponse>({
    queryKey: ['illustrations', storyId],
    queryFn: async () => {
      const backend = await fetchIllustrations(storyId).catch((): IllustrationJobResponse => ({
        jobStatus: 'NONE',
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: [],
      }));
      const { data } = await supabase
        .from('generated_illustrations')
        .select('page_index, image_url, status')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false });
      const persisted = new Map<number, { pageNumber: number; imageUrl: string; status: string }>();
      for (const row of data ?? []) {
        const pageNumber = Number(row.page_index);
        if (!Number.isFinite(pageNumber) || persisted.has(pageNumber)) continue;
        persisted.set(pageNumber, {
          pageNumber,
          imageUrl: row.image_url ?? '',
          status: row.status === 'ready' && row.image_url ? 'COMPLETED' : String(row.status ?? 'FAILED').toUpperCase(),
        });
      }
      for (const image of backend.illustrations) {
        if (!persisted.has(image.pageNumber)) persisted.set(image.pageNumber, image);
      }
      const illustrations = Array.from(persisted.values()).sort((a, b) => a.pageNumber - b.pageNumber);
      const completedPages = illustrations.filter((image) => image.status === 'COMPLETED' && !!image.imageUrl).length;
      const failedPages = illustrations.filter((image) => image.status === 'FAILED').length;
      return {
        jobStatus: illustrations.length > 0 && completedPages === illustrations.length ? 'COMPLETED' : backend.jobStatus,
        totalPages: Math.max(backend.totalPages, illustrations.length),
        completedPages,
        failedPages,
        illustrations,
      };
    },
    enabled: !!storyId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isGenerating = ['PENDING', 'PROCESSING', 'GENERATING'].includes(data.jobStatus);
      return isGenerating ? 3000 : false;
    },
  });
};
