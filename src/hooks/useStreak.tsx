import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Daily Streak tracker stored in localStorage.
 *
 * Rules:
 * - Visiting the app on a new calendar day increments the streak.
 * - Visiting on the same day is a no-op.
 * - Skipping a day (gap > 1 calendar day) resets the streak to 1.
 * - Hitting milestones (7, 30) awards a free Spin Wheel token, once per milestone level.
 */

const STREAK_KEY = "najmah:streak";
const MILESTONES_KEY = "najmah:streak:milestonesClaimed";
export const FREE_SPINS_KEY = "najmah:streak:freeSpins";

export const STREAK_MILESTONES = [7, 30] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

interface StoredStreak {
  count: number;
  /** YYYY-MM-DD of last check-in (local time) */
  lastDate: string;
}

const todayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysBetween = (a: string, b: string): number => {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
};

const readStreak = (): StoredStreak => {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { count: 0, lastDate: "" };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      lastDate: typeof parsed.lastDate === "string" ? parsed.lastDate : "",
    };
  } catch {
    return { count: 0, lastDate: "" };
  }
};

const readMilestones = (): number[] => {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(Number).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const readFreeSpins = (): number => {
  try {
    return Math.max(0, Number(localStorage.getItem(FREE_SPINS_KEY) || 0));
  } catch {
    return 0;
  }
};

export interface UseStreakReturn {
  /** Current streak count (consecutive days). */
  streak: number;
  /** Last check-in date YYYY-MM-DD. */
  lastDate: string;
  /** Milestone numbers already awarded. */
  claimedMilestones: number[];
  /** Free Spin Wheel tokens available. */
  freeSpins: number;
  /**
   * Newly awarded milestone in *this* mount (one-shot).
   * Use it to display a celebration toast/modal.
   */
  newMilestone: StreakMilestone | null;
  /** Clear the newMilestone after the UI has shown it. */
  acknowledgeMilestone: () => void;
  /** Consume one free spin token (returns true if available). */
  consumeFreeSpin: () => boolean;
}

/**
 * Track and increment the daily streak. Auto-runs on mount.
 * Safe to call from multiple components — they will sync via the `storage` event.
 */
export const useStreak = (): UseStreakReturn => {
  const [streak, setStreak] = useState(0);
  const [lastDate, setLastDate] = useState("");
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>([]);
  const [freeSpins, setFreeSpins] = useState(0);
  const [newMilestone, setNewMilestone] = useState<StreakMilestone | null>(null);

  // Refresh state from localStorage
  const refresh = useCallback(() => {
    const s = readStreak();
    setStreak(s.count);
    setLastDate(s.lastDate);
    setClaimedMilestones(readMilestones());
    setFreeSpins(readFreeSpins());
  }, []);

  // Daily check-in logic — runs once per mount
  useEffect(() => {
    const today = todayKey();
    const stored = readStreak();
    let nextCount = stored.count;

    if (!stored.lastDate) {
      // First ever visit
      nextCount = 1;
    } else {
      const diff = daysBetween(stored.lastDate, today);
      if (diff === 0) {
        // Same day — no change
        nextCount = stored.count || 1;
      } else if (diff === 1) {
        nextCount = stored.count + 1;
      } else if (diff > 1) {
        nextCount = 1; // streak broken
      } else {
        // Negative diff (clock change) — keep as is
        nextCount = stored.count || 1;
      }
    }

    const updated: StoredStreak = { count: nextCount, lastDate: today };
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));

    // Award milestones
    const claimed = readMilestones();
    let awarded: StreakMilestone | null = null;
    let spins = readFreeSpins();
    for (const m of STREAK_MILESTONES) {
      if (nextCount >= m && !claimed.includes(m)) {
        claimed.push(m);
        spins += 1;
        awarded = m as StreakMilestone; // last one wins for display
      }
    }
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(claimed));
    localStorage.setItem(FREE_SPINS_KEY, String(spins));

    setStreak(nextCount);
    setLastDate(today);
    setClaimedMilestones(claimed);
    setFreeSpins(spins);
    if (awarded) setNewMilestone(awarded);

    // Fire-and-forget server-side sync so admins/parents see real numbers
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase.functions.invoke("update-streak", { body: { minutesRead: 0 } }).catch(() => {});
      }
    });
  }, []);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STREAK_KEY ||
        e.key === MILESTONES_KEY ||
        e.key === FREE_SPINS_KEY
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const acknowledgeMilestone = useCallback(() => setNewMilestone(null), []);

  const consumeFreeSpin = useCallback((): boolean => {
    const current = readFreeSpins();
    if (current <= 0) return false;
    const next = current - 1;
    localStorage.setItem(FREE_SPINS_KEY, String(next));
    setFreeSpins(next);
    return true;
  }, []);

  return {
    streak,
    lastDate,
    claimedMilestones,
    freeSpins,
    newMilestone,
    acknowledgeMilestone,
    consumeFreeSpin,
  };
};
