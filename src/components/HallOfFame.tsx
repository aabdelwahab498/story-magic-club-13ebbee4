import { useTranslation } from "react-i18next";
import { Star, Heart } from "lucide-react";
import { useTopDrawings } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";

const HallOfFame = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: winners = [] } = useTopDrawings(6);

  if (winners.length === 0) return null;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 sm:h-6 sm:w-6 text-kids-orange fill-kids-orange" />
        <h3 className="text-lg sm:text-xl font-bold text-kids-midnight">
          {t("competition.hall.title")}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("competition.hall.subtitle")}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {winners.map((w, idx) => {
          const name = getLocalized(w.artist as never, lang);
          const country = w.artist?.country ? getLocalized(w.artist.country, lang) : "";
          return (
            <div
              key={w.id}
              className="group bg-card rounded-2xl overflow-hidden shadow-soft border-2 border-white/60 hover:shadow-glow hover-pop transition-all"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={w.image || "/placeholder.svg"}
                  alt={name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-2 start-2 bg-card/90 backdrop-blur rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold text-primary shadow-soft">
                  #{idx + 1}
                </div>
              </div>
              <div className="p-3">
                <p className="font-bold text-sm text-kids-midnight truncate">{name}</p>
                {country && (
                  <p className="text-xs text-muted-foreground truncate">
                    {w.artist?.countryFlag && <span className="me-1">{w.artist.countryFlag}</span>}
                    {country}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-2 text-kids-red text-xs font-semibold">
                  <Heart className="h-3 w-3 fill-kids-red" />
                  <span>{w.votes}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HallOfFame;
