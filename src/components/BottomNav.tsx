import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, BookOpen, Sparkles, Brush, ShoppingBag } from "lucide-react";
import { useSoundEffects } from "@/hooks/useSoundEffects";

type Item = { to: string; labelKey: string; icon: typeof Home };

const items: Item[] = [
  { to: "/", labelKey: "nav.home", icon: Home },
  { to: "/stories", labelKey: "nav.stories", icon: BookOpen },
  { to: "/ai-storyteller", labelKey: "nav.ai_storyteller", icon: Sparkles },
  { to: "/drawing-competition", labelKey: "nav.drawing_contest", icon: Brush },
  { to: "/store", labelKey: "nav.store", icon: ShoppingBag },
];

const BottomNav = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const sfx = useSoundEffects();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 dark:bg-card/85 backdrop-blur-xl border-t-2 border-kids-softPurple/40 dark:border-primary/30 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around px-1.5 pt-1.5">
        {items.map(({ to, labelKey, icon: Icon }) => {
          const active = isActive(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                onClick={() => sfx.playSound("click")}
                aria-label={t(labelKey)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-2xl transition-all duration-300 min-h-[56px] ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${
                    active
                      ? "bg-primary/15 scale-110 shadow-soft"
                      : "group-hover:bg-accent/40"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "animate-wiggle" : ""}`} />
                </span>
                <span
                  className={`text-[10px] leading-none font-bold truncate max-w-[64px] ${
                    active ? "opacity-100" : "opacity-80"
                  }`}
                >
                  {t(labelKey)}
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-primary to-primary-glow"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
