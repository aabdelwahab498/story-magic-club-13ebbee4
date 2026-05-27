import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "auto";

interface ThemeCtx {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

const STORAGE_KEY = "starry-tales-theme-mode";

/** Returns the appropriate theme for the current time (8 PM - 6 AM = dark). */
function getTimeBasedTheme(): Theme {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 6 ? "dark" : "light";
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored ?? "light";
  });

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "auto") return getTimeBasedTheme();
    if (stored === "dark") return "dark";
    return "light";
  });

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  // Resolve mode → theme
  useEffect(() => {
    if (mode === "auto") {
      setTheme(getTimeBasedTheme());
      // Re-check every minute when in auto mode
      const interval = setInterval(() => {
        setTheme(getTimeBasedTheme());
      }, 60_000);
      return () => clearInterval(interval);
    }
    setTheme(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Manual toggle always overrides auto
    setMode(theme === "dark" ? "light" : "dark");
  }, [theme, setMode]);

  return (
    <Ctx.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
