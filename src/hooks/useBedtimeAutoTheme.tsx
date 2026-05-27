// Auto Bedtime Dark Mode — checks parent's bedtime_schedules and forces dark
// theme when current local time falls inside any active window. Re-checks every minute.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTheme } from "./useTheme";

interface Schedule {
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
  dark_mode: boolean;
}

const FLAG_KEY = "starry-tales-bedtime-active";

const parseHMS = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const isInsideSchedule = (s: Schedule, now: Date): boolean => {
  if (s.day_of_week !== now.getDay()) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseHMS(s.start_time);
  const end = parseHMS(s.end_time);
  // Handle wrap past midnight
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
};

export function useBedtimeAutoTheme() {
  const { user } = useAuth();
  const { setMode, mode } = useTheme();

  const { data: schedules } = useQuery({
    queryKey: ["bedtime-schedules-all", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from("bedtime_schedules")
        .select("day_of_week,start_time,end_time,dark_mode")
        .eq("parent_user_id", user!.id)
        .eq("dark_mode", true);
      if (error) return [];
      return (data ?? []) as Schedule[];
    },
  });

  useEffect(() => {
    if (!schedules || schedules.length === 0) return;

    const check = () => {
      const now = new Date();
      const inside = schedules.some((s) => isInsideSchedule(s, now));
      const wasActive = sessionStorage.getItem(FLAG_KEY) === "1";

      if (inside && !wasActive) {
        sessionStorage.setItem(FLAG_KEY, "1");
        if (mode !== "dark") setMode("dark");
      } else if (!inside && wasActive) {
        sessionStorage.removeItem(FLAG_KEY);
        // Restore to auto mode so user's preference re-applies
        if (mode === "dark") setMode("auto");
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [schedules, setMode, mode]);
}
