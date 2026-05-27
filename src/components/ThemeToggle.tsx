import { Sun, Moon, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, ThemeMode } from "@/hooks/useTheme";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const ThemeToggle = () => {
  const { t } = useTranslation();
  const { theme, mode, setMode, toggleTheme } = useTheme();
  const sfx = useSoundEffects();

  const handleSelect = (next: ThemeMode) => {
    sfx.playSound("sparkle");
    setMode(next);
  };

  const handleQuickToggle = () => {
    sfx.playSound("sparkle");
    toggleTheme();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onMouseEnter={sfx.onMouseEnter}
          onClick={(e) => {
            // Shift-click for quick toggle, normal click opens menu
            if (e.shiftKey) {
              e.preventDefault();
              handleQuickToggle();
            }
          }}
          aria-label={theme === "dark" ? t("theme.switch_to_light") : t("theme.switch_to_dark")}
          className="relative h-10 w-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-card/70 backdrop-blur border-2 border-kids-softPurple dark:border-primary/30 shadow-soft hover:scale-110 transition-all duration-300 hover-wiggle"
        >
          <Sun
            className={`h-5 w-5 text-kids-yellow absolute transition-all duration-500 ${
              theme === "dark" ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
            }`}
          />
          <Moon
            className={`h-5 w-5 text-primary-glow absolute transition-all duration-500 ${
              theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
            }`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl border-2 border-kids-softPurple dark:border-primary/30 shadow-glow">
        <DropdownMenuLabel className="font-bold">{t("theme.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelect("light")}
          className={`rounded-xl cursor-pointer ${mode === "light" ? "bg-secondary/40" : ""}`}
        >
          <Sun className="h-4 w-4 me-2 text-kids-yellow" />
          <span className="font-semibold">{t("theme.light")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("dark")}
          className={`rounded-xl cursor-pointer ${mode === "dark" ? "bg-primary/20" : ""}`}
        >
          <Moon className="h-4 w-4 me-2 text-primary" />
          <span className="font-semibold">{t("theme.dark")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("auto")}
          className={`rounded-xl cursor-pointer ${mode === "auto" ? "bg-accent/30" : ""}`}
        >
          <Clock className="h-4 w-4 me-2 text-accent" />
          <span className="font-semibold">{t("theme.auto")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
