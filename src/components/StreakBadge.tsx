import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStreak } from "@/hooks/useStreak";

/**
 * Compact streak badge for the navigation bar.
 * Shows current streak count with a flame icon and a free-spin dot when available.
 */
const StreakBadge = () => {
  const { t } = useTranslation();
  const { streak, freeSpins } = useStreak();

  if (streak <= 0) return null;

  return (
    <div
      className="relative inline-flex items-center gap-1.5 rounded-full bg-sunset px-2.5 py-1 text-xs font-bold text-kids-midnight shadow-soft"
      title={t("streak.tooltip", { count: streak })}
      aria-label={t("streak.tooltip", { count: streak })}
    >
      <Flame className="h-3.5 w-3.5" />
      <span className="tabular-nums">{streak}</span>
      {freeSpins > 0 && (
        <span
          className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-soft animate-pulse"
          aria-label={t("streak.free_spins_available", { count: freeSpins })}
        >
          {freeSpins}
        </span>
      )}
    </div>
  );
};

export default StreakBadge;
