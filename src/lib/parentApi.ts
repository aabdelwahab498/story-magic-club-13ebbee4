// Phase 5 — bedtime schedule + parent stats hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  avgQuality: number;
  passedCount: number;
  recentTitles: { id: string; title: string | null; created_at: string; quality_total: number | null }[];
  skillCounts: Record<string, number>;
}

export const useChildStats = (childId?: string | null) =>
  useQuery({
    queryKey: ["child_stats", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildStats> => {
      const { data, error } = await supabase
        .from("ai_story_history")
        .select("id,title,created_at,quality_total,safety_passed,sel_outcome")
        .eq("child_profile_id", childId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = data ?? [];
      const totals = rows.map((r) => r.quality_total ?? 0).filter((x) => x > 0);
      const skillCounts: Record<string, number> = {};
      for (const r of rows) {
        const skill = (r.sel_outcome as { skill?: string } | null)?.skill;
        if (skill) skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
      }
      return {
        totalStories: rows.length,
        avgQuality: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0,
        passedCount: rows.filter((r) => r.safety_passed).length,
        recentTitles: rows.slice(0, 10).map((r) => ({
          id: r.id as string,
          title: r.title as string | null,
          created_at: r.created_at as string,
          quality_total: r.quality_total as number | null,
        })),
        skillCounts,
      };
    },
  });
