import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, Brush, ArrowRight, Heart } from "lucide-react";
import CountdownTimer from "./CountdownTimer";
import { getWeeklyDeadline } from "@/lib/competitionDates";
import { useWinnerOfTheWeek } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";

/**
 * Home page section that highlights the current Drawing Competition:
 * weekly theme + mini countdown + winner of the week + CTA.
 */
const HomeCompetitionHighlight = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const deadline = useMemo(() => getWeeklyDeadline(), []);
  const { data } = useWinnerOfTheWeek();
  const w = data && typeof data === "object" ? data : null;

  return (
    <section className="my-10 sm:my-14">
      <div className="flex items-end justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Brush className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
            {t("home.competition_section_title")}
          </h2>
        </div>
        <Link
          to="/drawing-competition"
          className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          {t("home.see_all")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Weekly challenge card */}
        <div className="lg:col-span-3 relative overflow-hidden rounded-3xl bg-magic p-5 sm:p-6 shadow-glow border-2 border-white/60">
          <div className="absolute inset-0 starry-sky opacity-40" />
          <div className="relative z-10 text-white">
            <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold mb-3">
              ✨ {t("competition.weekly.eyebrow")}
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
              {t("home.competition_theme_label")}:{" "}
              <span className="underline decoration-white/40 decoration-2 underline-offset-4">
                {t("drawing.current_theme")}
              </span>
            </h3>
            <p className="text-sm sm:text-base text-white/90 mb-4">
              {t("home.competition_subtitle")}
            </p>

            <p className="text-[11px] uppercase tracking-wider text-white/80 font-bold mb-2">
              {t("competition.weekly.ends_in")}
            </p>
            <CountdownTimer deadline={deadline} />

            <Link
              to="/drawing-competition"
              className="mt-5 inline-flex items-center gap-2 bg-sunset text-kids-midnight px-5 py-2.5 rounded-full font-extrabold text-sm shadow-pop hover-pop"
            >
              <Brush className="h-4 w-4" />
              {t("home.competition_join_cta")}
            </Link>
          </div>
        </div>

        {/* Winner of the week mini card */}
        {w && (
          <Link
            to="/drawing-competition"
            className="lg:col-span-2 group relative bg-card rounded-3xl shadow-soft border-2 border-white/60 overflow-hidden hover:shadow-glow transition-all flex flex-col"
          >
            <div className="relative h-40 sm:h-48 overflow-hidden">
              <img
                src={w.image || "/placeholder.svg"}
                alt={getLocalized(w.artist as never, lang)}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 start-3 bg-kids-yellow text-kids-midnight font-bold px-2.5 py-1 rounded-full text-xs shadow-soft inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                {t("competition.winner.title")}
              </div>
            </div>
            <div className="p-4 sm:p-5 flex-1 flex flex-col">
              <h4 className="font-extrabold text-lg text-foreground">
                {getLocalized(w.artist as never, lang)}
              </h4>
              {w.artist?.country && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {w.artist.countryFlag && <span className="me-1">{w.artist.countryFlag}</span>}
                  {getLocalized(w.artist.country, lang)}
                </p>
              )}
              <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-kids-red font-bold text-sm">
                  <Heart className="h-4 w-4 fill-kids-red" />
                  {w.votes}
                </span>
                <span className="text-xs font-semibold text-primary inline-flex items-center gap-1">
                  {t("home.competition_view_cta")}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
};

export default HomeCompetitionHighlight;
