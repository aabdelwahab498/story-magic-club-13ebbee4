import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import bookIllustration from "@/assets/illustration-book.png";
import wandIllustration from "@/assets/illustration-wand.png";
import paletteIllustration from "@/assets/illustration-palette.png";
import moonIllustration from "@/assets/illustration-moon.webp";
import starMascot from "@/assets/sleeping-angel-moon-opt.webp";
import AnimatedLogo from "@/components/AnimatedLogo";
import CountersSection from "@/components/CountersSection";
import HomeBlogPreview from "@/components/HomeBlogPreview";
import SubscriptionWheelTeaser from "@/components/SubscriptionWheelTeaser";
import StreakCard from "@/components/StreakCard";
import HomeCompetitionHighlight from "@/components/HomeCompetitionHighlight";
import FreeTrialDialog from "@/components/FreeTrialDialog";
import { Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const sfx = useSoundEffects();
  const [trialOpen, setTrialOpen] = useState(false);


  const cards = [
    {
      to: "/stories",
      img: bookIllustration,
      bg: "from-kids-softBlue to-white",
      ring: "ring-kids-blue/40",
      titleKey: "home.stories_title",
      descKey: "home.stories_desc",
      delay: "0s",
    },
    {
      to: "/ai-storyteller",
      img: wandIllustration,
      bg: "from-kids-softPurple to-white",
      ring: "ring-primary/40",
      titleKey: "home.ai_title",
      descKey: "home.ai_desc",
      delay: "2s",
    },
    {
      to: "/drawing-competition",
      img: paletteIllustration,
      bg: "from-kids-softYellow to-white",
      ring: "ring-kids-yellow/60",
      titleKey: "home.drawing_title",
      descKey: "home.drawing_desc",
      delay: "4s",
    },
  ];

  // Pre-compute random sparkle positions ONCE so they don't recalculate
  // on every render (was 18 sparkles × every render → noticeable jank).
  const topSparkles = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        top: Math.random() * 90,
        left: Math.random() * 95,
        delay: Math.random() * 3,
        size: 10 + Math.random() * 18,
      })),
    [],
  );

  // Bottom CTA stars — fewer and memoized
  const ctaStars = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 4 + 1,
        delay: Math.random() * 2,
      })),
    [],
  );

  return (
    <div className="py-1 sm:py-2 relative" key={i18n.language}>
      {/* Floating background sparkles — positions memoized */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-0">
        {topSparkles.map((s, i) => (
          <div
            key={i}
            className="absolute text-2xl animate-twinkle select-none opacity-70"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              animationDelay: `${s.delay}s`,
              fontSize: `${s.size}px`,
            }}
            aria-hidden="true"
          >
            ✨
          </div>
        ))}
      </div>

      <div className="text-center -mt-6 sm:-mt-10 md:-mt-14 lg:-mt-16 mb-3 sm:mb-4 lg:mb-6 animate-fade-in relative">
        <div className="flex items-center justify-center">
          <div className="relative w-[11rem] h-[11rem] sm:w-[14rem] sm:h-[14rem] md:w-[16rem] md:h-[16rem] lg:w-[18rem] lg:h-[18rem] mx-auto">


            <img
              src={starMascot}
              alt=""
              aria-hidden="true"
              width={400}
              height={400}
              className="absolute inset-0 w-full h-full object-contain animate-float drop-shadow-2xl"
            />
            {/* Tiny twinkles around the moon */}
            <span className="absolute text-kids-yellow text-xl sm:text-2xl animate-twinkle" style={{ top: '28%', right: '4%' }} aria-hidden="true">✨</span>
            <span className="absolute text-kids-pink text-lg sm:text-xl animate-twinkle" style={{ bottom: '24%', left: '4%', animationDelay: '1.5s' }} aria-hidden="true">⭐</span>
          </div>
          <h1 className="sr-only">{t("app.name")}</h1>
        </div>
        <div className="mt-1 sm:mt-2 max-w-2xl mx-auto px-3 relative z-10 space-y-1 sm:space-y-1.5">
          <p className="text-sm sm:text-base md:text-xl lg:text-2xl font-bold text-kids-midnight dark:text-white leading-snug">
            {t("app.tagline_main")}
          </p>
          <p className="text-xs sm:text-base md:text-lg font-semibold text-primary dark:text-kids-yellow leading-snug">
            {t("app.tagline_sub")}
          </p>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground dark:text-white/80 leading-snug italic">
            {t("app.tagline_focus")}
          </p>
          <button
            {...sfx}
            onClick={() => { sfx.playSound("sparkle"); setTrialOpen(true); }}
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 sm:px-7 sm:py-3 bg-gradient-to-r from-primary to-kids-pink text-white font-bold rounded-full shadow-pop hover-pop text-sm sm:text-base animate-pulse-slow"
          >
            <Sparkles className="h-5 w-5" />
            {t("home.try_free_cta", "Try generating a story for free")}
          </button>
        </div>
      </div>

      <FreeTrialDialog open={trialOpen} onOpenChange={setTrialOpen} />



      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto mb-6 sm:mb-8 lg:mb-10 relative">
        {cards.map(({ to, img, bg, ring, titleKey, descKey, delay }) => (
          <button
            key={to}
            {...sfx}
            onClick={() => {
              sfx.playSound("sparkle");
              navigate(to);
            }}
            style={{ animationDelay: delay }}
            className={`group relative bg-gradient-to-br ${bg} text-card-foreground rounded-3xl shadow-soft p-4 sm:p-6 cursor-pointer text-start ring-2 ring-transparent hover:${ring} hover-pop hover:animate-float-slower border-2 border-white/60`}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 bg-white/70 shadow-inner group-hover:animate-wiggle">
              <img
                src={img}
                alt=""
                width={112}
                height={112}
                loading="lazy"
                className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 object-contain"
              />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2 text-kids-midnight">
              {t(titleKey)}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground text-center">{t(descKey)}</p>
            <span
              className="absolute -top-2 -right-2 text-2xl animate-twinkle"
              aria-hidden="true"
            >
              ⭐
            </span>
          </button>
        ))}
      </div>

      <CountersSection />

      <StreakCard />

      <HomeCompetitionHighlight />

      <SubscriptionWheelTeaser />

      <HomeBlogPreview />

      <div className="relative h-auto min-h-[18rem] sm:h-72 bg-kids-midnight rounded-3xl overflow-hidden mb-8 shadow-glow mt-10">
        <div className="absolute inset-0">
          {ctaStars.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </div>

        <img
          src={moonIllustration}
          alt=""
          width={120}
          height={120}
          loading="lazy"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 h-16 w-16 sm:h-24 sm:w-24 animate-float opacity-90"
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-white p-4 sm:p-6 py-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-center">
            {t("home.cta_title")}
          </h2>
          <p className="text-base sm:text-lg text-center max-w-lg mb-5 sm:mb-6 px-2">{t("home.cta_desc")}</p>
          <button
            {...sfx}
            onClick={() => {
              sfx.playSound("sparkle");
              navigate("/stories");
            }}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-sunset text-kids-midnight font-bold rounded-full hover-pop shadow-pop text-base sm:text-lg"
          >
            ✨ {t("home.cta_button")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
