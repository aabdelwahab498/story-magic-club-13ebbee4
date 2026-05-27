import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Trophy, Gift, Sparkles } from "lucide-react";
import { useStreak, STREAK_MILESTONES } from "@/hooks/useStreak";
import SpinWheelModal from "./SpinWheelModal";
import { toast } from "@/hooks/use-toast";

/**
 * Larger streak panel for the Home page.
 * Shows current streak, milestone badges (7 / 30), progress to the next milestone,
 * and a CTA to use free Spin Wheel tokens earned from streaks.
 */
const StreakCard = () => {
  const { t } = useTranslation();
  const { streak, claimedMilestones, freeSpins, newMilestone, acknowledgeMilestone } = useStreak();
  const [open, setOpen] = useState(false);

  // Celebrate newly reached milestones with a toast (one-shot per mount)
  useEffect(() => {
    if (newMilestone) {
      toast({
        title: t("streak.milestone_toast_title", { days: newMilestone }),
        description: t("streak.milestone_toast_desc"),
      });
      acknowledgeMilestone();
    }
  }, [newMilestone, acknowledgeMilestone, t]);

  // Find next unreached milestone for the progress bar
  const nextMilestone =
    STREAK_MILESTONES.find((m) => streak < m) ??
    STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  const progressBase =
    STREAK_MILESTONES.filter((m) => m <= streak).pop() ?? 0;
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((streak - progressBase) / Math.max(1, nextMilestone - progressBase)) * 100
    )
  );
  const reachedAll = streak >= STREAK_MILESTONES[STREAK_MILESTONES.length - 1];

  return (
    <section className="my-10 sm:my-14">
      <div className="relative overflow-hidden rounded-3xl bg-sunset p-5 sm:p-7 shadow-glow border-2 border-white/60">
        <span
          className="absolute -top-8 -end-8 text-9xl opacity-15 select-none"
          aria-hidden="true"
        >
          🔥
        </span>

        <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-5 items-center text-kids-midnight">
          {/* Big streak number */}
          <div className="flex items-center gap-3">
            <div className="bg-white/40 backdrop-blur rounded-2xl p-3 sm:p-4 border-2 border-white/60">
              <Flame className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-extrabold leading-none tabular-nums">
                {streak}
              </div>
              <div className="text-xs sm:text-sm font-medium opacity-90 mt-1">
                {t("streak.days", { count: streak })}
              </div>
            </div>
          </div>

          {/* Middle: title + milestone badges + progress */}
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-extrabold mb-1">
              {t("streak.title")}
            </h3>
            <p className="text-sm text-kids-midnight/85 mb-3">
              {reachedAll
                ? t("streak.legend")
                : t("streak.next_in", {
                    days: nextMilestone - streak,
                    milestone: nextMilestone,
                  })}
            </p>

            {/* Progress bar */}
            <div className="h-2.5 w-full rounded-full bg-kids-midnight/15 overflow-hidden mb-3">
              <div
                className="h-full bg-kids-midnight rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Milestone badges */}
            <div className="flex flex-wrap gap-2">
              {STREAK_MILESTONES.map((m) => {
                const earned = claimedMilestones.includes(m);
                return (
                  <span
                    key={m}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border-2 transition-all ${
                      earned
                        ? "bg-card text-primary border-card shadow-soft"
                        : "bg-kids-midnight/10 text-kids-midnight/70 border-kids-midnight/20"
                    }`}
                    aria-label={
                      earned
                        ? t("streak.badge_earned", { days: m })
                        : t("streak.badge_locked", { days: m })
                    }
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {t("streak.badge_label", { days: m })}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Right: free spin CTA */}
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <button
              onClick={() => setOpen(true)}
              className="relative inline-flex items-center justify-center gap-2 rounded-full bg-card text-primary px-5 py-3 font-extrabold shadow-pop hover-pop disabled:opacity-70 whitespace-nowrap"
            >
              {freeSpins > 0 ? (
                <>
                  <Gift className="h-4 w-4" />
                  {t("streak.claim_spin")}
                  <span className="ms-1 inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px]">
                    {freeSpins}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("streak.spin_wheel")}
                </>
              )}
            </button>
            <p className="text-[11px] text-kids-midnight/80 text-center sm:text-end max-w-[14rem]">
              {freeSpins > 0 ? t("streak.free_spin_hint") : t("streak.earn_spin_hint")}
            </p>
          </div>
        </div>
      </div>

      <SpinWheelModal open={open} onOpenChange={setOpen} />
    </section>
  );
};

export default StreakCard;
