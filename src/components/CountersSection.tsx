import { useTranslation } from "react-i18next";
import { BookOpen, Users, Brush } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import { useSiteStats } from "@/lib/contentApi";

const CountersSection = () => {
  const { t } = useTranslation();
  const { data: stats } = useSiteStats();

  const items = [
    {
      icon: BookOpen,
      value: stats?.total_stories ?? 0,
      label: t("counters.stories"),
      bg: "from-kids-softBlue to-white",
      ring: "text-kids-blue",
    },
    {
      icon: Users,
      value: stats?.total_users ?? 0,
      label: t("counters.users"),
      bg: "from-kids-softPurple to-white",
      ring: "text-primary",
    },
    {
      icon: Brush,
      value: stats?.total_drawings ?? 0,
      label: t("counters.drawings"),
      bg: "from-kids-softYellow to-white",
      ring: "text-kids-yellow",
    },
  ];

  return (
    <section className="my-10 sm:my-14">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-foreground">
        {t("counters.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
        {items.map(({ icon: Icon, value, label, bg, ring }) => (
          <div
            key={label}
            className={`bg-gradient-to-br ${bg} rounded-3xl p-6 text-center shadow-soft border-2 border-white/60 hover-pop`}
          >
            <Icon className={`h-10 w-10 mx-auto mb-3 ${ring}`} />
            <div className="text-4xl sm:text-5xl font-extrabold text-kids-midnight">
              <AnimatedCounter value={value} suffix="+" />
            </div>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground font-medium">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CountersSection;
