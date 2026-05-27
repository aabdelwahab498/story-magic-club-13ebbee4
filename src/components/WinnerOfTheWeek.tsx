import { useTranslation } from "react-i18next";
import { Trophy, Heart, Crown } from "lucide-react";
import { useWinnerOfTheWeek } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";

const WinnerOfTheWeek = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: w } = useWinnerOfTheWeek();

  if (!w) return null;
  const name = getLocalized(w.artist as never, lang);
  const country = w.artist?.country ? getLocalized(w.artist.country, lang) : "";
  const title = getLocalized(w.title, lang);

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-kids-yellow" />
        <h3 className="text-lg sm:text-xl font-bold text-kids-midnight">
          {t("competition.winner.title")}
        </h3>
      </div>

      <div className="bg-card rounded-3xl shadow-soft overflow-hidden border-2 border-white/60 hover:shadow-glow transition-all">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-64 md:h-auto">
            <img
              src={w.image || "/placeholder.svg"}
              alt={name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 start-3 bg-kids-yellow text-kids-midnight font-bold px-3 py-1.5 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              {t("competition.winner.badge")}
            </div>
          </div>
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div>
              <h4 className="text-2xl sm:text-3xl font-bold text-kids-midnight">{name}</h4>
              {country && (
                <p className="text-base text-muted-foreground mt-1">
                  {w.artist?.countryFlag && <span className="me-1">{w.artist.countryFlag}</span>}
                  {country}
                </p>
              )}
              {title && (
                <div className="mt-4 inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                  <span className="text-muted-foreground">{t("competition.winner.theme")}:</span>
                  <span className="font-semibold text-kids-midnight">{title}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-kids-red">
                <Heart className="h-5 w-5 fill-kids-red" />
                <span className="font-bold text-lg">{w.votes}</span>
                <span className="text-sm text-muted-foreground">
                  {t("drawing.votes", { count: w.votes })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WinnerOfTheWeek;
