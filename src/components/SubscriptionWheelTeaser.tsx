import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Gift, Sparkles } from "lucide-react";
import SpinWheelModal from "./SpinWheelModal";

const SubscriptionWheelTeaser = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="my-10 sm:my-14 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      {/* Subscription teaser */}
      <Link
        to="/pricing"
        className="group relative bg-gradient-to-br from-kids-softPurple via-white to-kids-softBlue dark:from-card dark:via-card dark:to-card rounded-3xl p-6 shadow-soft border-2 border-white/60 hover-pop overflow-hidden"
      >
        <span className="absolute -top-6 -end-6 text-7xl opacity-20 select-none" aria-hidden="true">💎</span>
        <Sparkles className="h-8 w-8 text-primary mb-3" />
        <h3 className="text-xl sm:text-2xl font-extrabold text-foreground mb-2">
          {t("home.sub_teaser_title")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("home.sub_teaser_desc")}
        </p>
        <span className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-soft group-hover:gap-2 transition-all">
          {t("home.sub_teaser_cta")}
        </span>
      </Link>

      {/* Wheel teaser */}
      <button
        onClick={() => setOpen(true)}
        className="group relative bg-gradient-to-br from-kids-softYellow via-white to-sunset/30 dark:from-card dark:via-card dark:to-card rounded-3xl p-6 shadow-soft border-2 border-white/60 hover-pop overflow-hidden text-start"
      >
        <span className="absolute -top-6 -end-6 text-7xl opacity-20 select-none" aria-hidden="true">🎡</span>
        <Gift className="h-8 w-8 text-amber-500 mb-3" />
        <h3 className="text-xl sm:text-2xl font-extrabold text-foreground mb-2">
          {t("home.wheel_teaser_title")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("home.wheel_teaser_desc")}
        </p>
        <span className="inline-flex items-center gap-1 px-4 py-2 bg-sunset text-kids-midnight rounded-full text-sm font-bold shadow-pop group-hover:gap-2 transition-all">
          {t("home.wheel_teaser_cta")}
        </span>
      </button>

      <SpinWheelModal open={open} onOpenChange={setOpen} />
    </section>
  );
};

export default SubscriptionWheelTeaser;
