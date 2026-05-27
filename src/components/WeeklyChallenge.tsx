import { useTranslation } from "react-i18next";
import { Sparkles, Calendar, Award } from "lucide-react";
import CountdownTimer from "./CountdownTimer";
import { getWeeklyDeadline } from "@/lib/mockCompetition";
import { useMemo } from "react";

const WeeklyChallenge = () => {
  const { t } = useTranslation();
  const deadline = useMemo(() => getWeeklyDeadline(), []);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-magic p-6 sm:p-8 mb-6 sm:mb-8 shadow-glow">
      <div className="absolute inset-0 starry-sky opacity-50" />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <div className="text-white">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs sm:text-sm font-semibold mb-3">
            <Sparkles className="h-4 w-4" />
            {t("competition.weekly.eyebrow")}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
            {t("competition.weekly.title")}
          </h2>
          <p className="text-base sm:text-lg text-white/90 mb-4">
            {t("competition.weekly.theme_label")}:{" "}
            <span className="font-bold">{t("drawing.current_theme")}</span>
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full">
              <Calendar className="h-4 w-4" />
              {t("competition.weekly.weekly_reset")}
            </span>
            <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full">
              <Award className="h-4 w-4" />
              {t("drawing.prize_value")}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center lg:items-end gap-3">
          <p className="text-white/90 text-sm font-medium uppercase tracking-wider">
            {t("competition.weekly.ends_in")}
          </p>
          <CountdownTimer deadline={deadline} />
        </div>
      </div>
    </section>
  );
};

export default WeeklyChallenge;
