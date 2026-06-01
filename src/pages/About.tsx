import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Palette,
  Sparkles,
  Megaphone,
  GraduationCap,
  Star,
  ArrowRight,
  Lightbulb,
  Clock,
  PlayCircle,
  Quote,
  ShoppingBag,
} from "lucide-react";
import Seo from "@/components/Seo";
import instructorPhoto from "@/assets/instructor-elham.png";
import { useAuth } from "@/hooks/useAuth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const featureIcons = [BookOpen, Palette, Sparkles, Megaphone];
const featureGradients = [
  {
    g: "from-kids-softPurple/80 to-kids-softBlue/60",
    i: "bg-gradient-to-br from-primary to-kids-pink",
  },
  {
    g: "from-kids-softYellow/80 to-kids-softPurple/60",
    i: "bg-gradient-to-br from-kids-yellow to-kids-pink",
  },
  {
    g: "from-kids-softBlue/80 to-kids-softPurple/60",
    i: "bg-gradient-to-br from-kids-blue to-primary",
  },
  {
    g: "from-kids-softYellow/80 to-kids-softBlue/60",
    i: "bg-gradient-to-br from-kids-pink to-primary",
  },
];

type Feature = { title: string; desc: string };
type Module = {
  level: string;
  title: string;
  duration: string;
  lessons: number;
  topics: string[];
};
type Testimonial = { name: string; role: string; rating: number; quote: string };
type Faq = { q: string; a: string };

const About = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const handleCtaClick = () => {
    if (user) {
      navigate("/ai-storyteller");
    } else {
      navigate("/auth?mode=signup", { state: { from: "/ai-storyteller" } });
    }
  };

  const features = (t("about.features", { returnObjects: true }) as Feature[]) || [];
  const curriculum = (t("about.modules", { returnObjects: true }) as Module[]) || [];
  const testimonials =
    (t("about.testimonials", { returnObjects: true }) as Testimonial[]) || [];
  const faqs = (t("about.faqs", { returnObjects: true }) as Faq[]) || [];

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 6 + Math.random() * 16,
        delay: Math.random() * 4,
        emoji: ["✨", "⭐", "📖", "🌙"][Math.floor(Math.random() * 4)],
      })),
    []
  );

  return (
    <div className="relative py-6 sm:py-10 overflow-hidden" key={i18n.language}>
      <Seo title={t("about.seo_title")} description={t("about.seo_desc")} />

      {/* Floating magical particles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute animate-twinkle opacity-60 select-none"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              animationDelay: `${p.delay}s`,
            }}
            aria-hidden="true"
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto px-4 mb-12 sm:mb-16 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-md border border-primary/20 shadow-soft mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs sm:text-sm font-semibold text-primary">
            {t("about.badge")}
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-primary via-kids-pink to-kids-yellow bg-clip-text text-transparent mb-5 leading-tight">
          {t("about.hero_title")}
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground dark:text-white/80 leading-loose">
          {t("about.hero_desc")}
        </p>
      </section>

      {/* Origin story */}
      <section className="max-w-5xl mx-auto px-4 mb-14 sm:mb-20 animate-fade-in">
        <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-white/80 via-kids-softPurple/40 to-kids-softBlue/40 dark:from-card/80 dark:via-primary/10 dark:to-kids-blue/10 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-soft overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-kids-pink/20 rounded-full blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-kids-yellow to-kids-pink flex items-center justify-center shadow-pop">
              <Lightbulb className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-kids-midnight dark:text-white mb-3">
                {t("about.origin_title")}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground dark:text-white/85 leading-loose">
                {t("about.origin_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 mb-14 sm:mb-20">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-center bg-gradient-to-r from-primary via-kids-pink to-kids-yellow bg-clip-text text-transparent mb-8 sm:mb-10">
          {t("about.features_heading")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {features.map((f, idx) => {
            const Icon = featureIcons[idx] ?? Sparkles;
            const { g, i } = featureGradients[idx] ?? featureGradients[0];
            return (
              <article
                key={idx}
                style={{ animationDelay: `${idx * 0.12}s` }}
                className={`group relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br ${g} backdrop-blur-md border border-white/50 dark:border-white/10 shadow-soft hover:shadow-glow transition-all duration-500 hover:-translate-y-1 animate-fade-in`}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/30 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
                <div className="relative flex items-start gap-4">
                  <div
                    className={`${i} w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-pop shrink-0 group-hover:animate-wiggle`}
                  >
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold text-kids-midnight dark:text-white mb-2">
                      {f.title}
                    </h3>
                    <p className="text-sm sm:text-base text-kids-midnight/80 dark:text-white/85 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
                <Star
                  className="absolute top-3 left-3 h-4 w-4 text-kids-yellow animate-twinkle"
                  fill="currentColor"
                />
              </article>
            );
          })}
        </div>
      </section>

      {/* Founder / Instructor */}
      <section className="max-w-5xl mx-auto px-4 mb-12 animate-fade-in">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-center bg-gradient-to-r from-kids-pink via-primary to-kids-blue bg-clip-text text-transparent mb-8 sm:mb-10">
          {t("about.instructor_heading")}
        </h2>

        <div className="relative rounded-3xl p-1 bg-gradient-to-br from-primary via-kids-pink to-kids-yellow shadow-glow">
          <div className="rounded-[1.4rem] bg-white/85 dark:bg-card/85 backdrop-blur-xl p-6 sm:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="relative shrink-0">
              <div className="absolute -inset-2 bg-gradient-to-br from-primary via-kids-pink to-kids-yellow rounded-3xl blur-xl opacity-60 animate-pulse-slow" />
              <img
                src={instructorPhoto}
                alt={t("about.instructor_name")}
                width={260}
                height={260}
                className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 object-cover rounded-3xl shadow-pop ring-4 ring-white dark:ring-white/20"
              />
              <span className="absolute -top-2 -right-2 text-2xl animate-twinkle">✨</span>
              <span
                className="absolute -bottom-2 -left-2 text-xl animate-twinkle"
                style={{ animationDelay: "1s" }}
              >
                ⭐
              </span>
            </div>
            <div className="text-center md:text-start flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
                <GraduationCap className="h-3.5 w-3.5" />
                {t("about.instructor_role")}
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-kids-midnight dark:text-white mb-3">
                {t("about.instructor_name")}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground dark:text-white/85 leading-loose">
                {t("about.instructor_bio")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="max-w-6xl mx-auto px-4 mb-14 sm:mb-20">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary via-kids-pink to-kids-yellow bg-clip-text text-transparent mb-3">
            {t("about.curriculum_heading")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground dark:text-white/75 max-w-2xl mx-auto">
            {t("about.curriculum_desc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {curriculum.map((mod, idx) => (
            <article
              key={idx}
              style={{ animationDelay: `${idx * 0.1}s` }}
              className="group relative rounded-3xl p-6 sm:p-7 bg-white/80 dark:bg-card/80 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-soft hover:shadow-glow transition-all duration-500 hover:-translate-y-1 animate-fade-in"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-kids-pink text-white flex items-center justify-center font-extrabold shadow-pop">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                      {mod.level}
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold text-kids-midnight dark:text-white">
                      {mod.title}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kids-softPurple/40 dark:bg-primary/10 text-kids-midnight dark:text-white font-semibold">
                  <PlayCircle className="h-3.5 w-3.5" />
                  {t("about.lessons_count", { count: mod.lessons })}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kids-softYellow/40 dark:bg-kids-yellow/10 text-kids-midnight dark:text-white font-semibold">
                  <Clock className="h-3.5 w-3.5" />
                  {mod.duration}
                </span>
              </div>

              <ul className="space-y-2">
                {mod.topics.map((tp, ti) => (
                  <li
                    key={ti}
                    className="flex items-start gap-2 text-sm text-kids-midnight/85 dark:text-white/85"
                  >
                    <Sparkles className="h-4 w-4 text-kids-pink shrink-0 mt-0.5" />
                    <span>{tp}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 mb-14 sm:mb-20">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold bg-gradient-to-r from-kids-pink via-primary to-kids-blue bg-clip-text text-transparent mb-3">
            {t("about.testimonials_heading")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground dark:text-white/75">
            {t("about.testimonials_desc")}
          </p>
        </div>

        <Carousel opts={{ align: "start", loop: true }} className="px-2 sm:px-8">
          <CarouselContent className="-ml-3">
            {testimonials.map((ts, idx) => (
              <CarouselItem
                key={idx}
                className="pl-3 basis-full sm:basis-1/2 lg:basis-1/3"
              >
                <div className="h-full rounded-3xl p-6 bg-gradient-to-br from-white/85 to-kids-softPurple/40 dark:from-card/85 dark:to-primary/10 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-soft hover:shadow-glow transition-all duration-500 hover:-translate-y-1 flex flex-col">
                  <Quote className="h-7 w-7 text-primary/60 mb-3" />
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: ts.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 text-kids-yellow"
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-kids-midnight/85 dark:text-white/85 leading-relaxed flex-1">
                    “{ts.quote}”
                  </p>
                  <div className="mt-4 pt-4 border-t border-kids-softPurple/40 dark:border-white/10">
                    <p className="font-bold text-kids-midnight dark:text-white">
                      {ts.name}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-white/65">
                      {ts.role}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 mb-14 sm:mb-20">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary via-kids-pink to-kids-yellow bg-clip-text text-transparent mb-3">
            {t("about.faq_heading")}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground dark:text-white/75">
            {t("about.faq_desc")}
          </p>
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-3xl bg-white/80 dark:bg-card/80 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-soft p-2 sm:p-4"
        >
          {faqs.map((f, idx) => (
            <AccordionItem
              key={idx}
              value={`faq-${idx}`}
              className="border-b border-kids-softPurple/40 dark:border-white/10 last:border-0"
            >
              <AccordionTrigger className="text-start text-sm sm:text-base font-bold text-kids-midnight dark:text-white hover:no-underline px-3">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground dark:text-white/80 leading-relaxed px-3">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="text-center px-4 animate-fade-in">
        <button
          onClick={handleCtaClick}
          className="group inline-flex items-center gap-3 px-7 sm:px-10 py-4 sm:py-5 rounded-full bg-gradient-to-r from-primary via-kids-pink to-kids-yellow text-white font-bold text-base sm:text-lg shadow-glow hover-pop"
        >
          <Sparkles className="h-5 w-5 group-hover:animate-wiggle" />
          {t("about.cta_button")}
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
        </button>
        {!user && (
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground dark:text-white/70">
            {t("about.cta_helper")}
          </p>
        )}
      </section>
    </div>
  );
};

export default About;
