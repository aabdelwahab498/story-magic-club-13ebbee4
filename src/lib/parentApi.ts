// Phase 5 — bedtime schedule + parent stats hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { storiesApi, StoryResponseDto } from "@/api/stories.api";
import { useState, useEffect } from "react";
export interface BedtimeSchedule {
  id: string;
  parent_user_id: string;
  child_profile_id: string;
  day_of_week: number; // 0 Sun .. 6 Sat
  start_time: string;  // "HH:MM"
  end_time: string;
  dark_mode: boolean;
}

export const useBedtimeSchedules = (childId?: string | null) =>
  useQuery({
    queryKey: ["bedtime_schedules", childId],
    enabled: !!childId,
    queryFn: async (): Promise<BedtimeSchedule[]> => {
      const { data, error } = await supabase
        .from("bedtime_schedules")
        .select("*")
        .eq("child_profile_id", childId!)
        .order("day_of_week", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BedtimeSchedule[];
    },
  });

export const useUpsertSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<BedtimeSchedule, "id" | "parent_user_id">) => {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("not_signed_in");
      const { error } = await supabase
        .from("bedtime_schedules")
        .upsert(
          [{ ...input, parent_user_id: uid }],
          { onConflict: "parent_user_id,child_profile_id,day_of_week" as never },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bedtime_schedules", v.child_profile_id] }),
  });
};

export const useDeleteSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bedtime_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bedtime_schedules"] }),
  });
};

export interface ChildStats {
  totalStories: number;
  completedCount: number;
  generatingCount: number;
  failedCount: number;
  recentTitles: { id: string; title: string; created_at: string; status: string }[];
  skillCounts: Record<string, number>;
}

export const useChildStats = (childId?: string | null) =>
  useQuery({
    queryKey: ["child_stats", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildStats> => {
      const data = await storiesApi.getStoriesByChild(childId!);
      const rows = data || [];
      
      const completedCount = rows.filter(r => r.status === 'generated').length;
      const failedCount = rows.filter(r => r.status === 'failed').length;
      const generatingCount = rows.filter(r => r.status === 'queued' || r.status === 'generating').length;

      const skillCounts: Record<string, number> = {};
      for (const r of rows) {
        const skill = r.selGoal;
        if (skill) skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
      }
      
      // Sort by createdAt descending
      const sorted = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        totalStories: rows.length,
        completedCount,
        generatingCount,
        failedCount,
        recentTitles: sorted.slice(0, 10).map((r) => ({
          id: r.id,
          title: r.theme ? `Story about ${r.theme}` : "Untitled",
          created_at: r.createdAt,
          status: r.status,
        })),
        skillCounts,
      };
    },
  });

export const useFavoriteStories = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("najmah.favorites");
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem("najmah.favorites", JSON.stringify(next));
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
};
