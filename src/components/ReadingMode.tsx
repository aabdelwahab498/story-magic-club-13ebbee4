// Quiet, distraction-free reading overlay for stories.
// Used by both the AI Storyteller and the StoryDetail library page.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Type, Sun, Moon, Leaf } from "lucide-react";

type Theme = "sepia" | "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-base sm:text-lg leading-loose",
  md: "text-lg sm:text-xl leading-loose",
  lg: "text-xl sm:text-2xl leading-loose",
  xl: "text-2xl sm:text-3xl leading-loose",
};

const THEME_CLASSES: Record<Theme, { bg: string; text: string; muted: string; surface: string }> = {
  sepia: {
    bg: "bg-[#f4ecd8]",
    text: "text-[#3b2f1f]",
    muted: "text-[#7a6a4f]",
    surface: "bg-[#ece2c7]",
  },
  light: {
    bg: "bg-white",
    text: "text-zinc-900",
    muted: "text-zinc-500",
    surface: "bg-zinc-100",
  },
  dark: {
    bg: "bg-[#0e0c1a]",
    text: "text-zinc-100",
    muted: "text-zinc-400",
    surface: "bg-white/10",
  },
};

interface Props {
  title: string;
  chapters: string[];
  language?: string;
  images?: (string | null | undefined)[];
  initialIndex?: number;
  onClose: () => void;
}

export const ReadingMode = ({
  title,
  chapters,
  language,
  images,
  initialIndex = 0,
  onClose,
}: Props) => {
  const [idx, setIdx] = useState(initialIndex);
  const [size, setSize] = useState<Size>("md");
  const [theme, setTheme] = useState<Theme>("sepia");

  const isRtl = language?.startsWith("ar");
  const total = chapters.length || 1;
  const safeIdx = Math.min(Math.max(idx, 0), total - 1);
  const text = chapters[safeIdx] || "";
  const image = images?.[safeIdx] ?? null;
  const themeClasses = THEME_CLASSES[theme];

  // Lock background scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => (isRtl ? Math.min(total - 1, i + 1) : Math.max(0, i - 1)));
      if (e.key === "ArrowRight") setIdx((i) => (isRtl ? Math.max(0, i - 1) : Math.min(total - 1, i + 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, isRtl, onClose]);

  const cycleSize = () => {
    const order: Size[] = ["sm", "md", "lg", "xl"];
    setSize((s) => order[(order.indexOf(s) + 1) % order.length]);
  };
  const cycleTheme = () => {
    const order: Theme[] = ["sepia", "light", "dark"];
    setTheme((t) => order[(order.indexOf(t) + 1) % order.length]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Leaf;
  const progress = ((safeIdx + 1) / total) * 100;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`fixed inset-0 z-[100] ${themeClasses.bg} ${themeClasses.text} animate-fade-in flex flex-col`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top bar */}
      <header className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-current/10`}>
        <h2 className="text-sm sm:text-base font-bold truncate flex-1">{title}</h2>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={cycleSize}
            className={`p-2 rounded-full ${themeClasses.surface} hover:opacity-80 transition-opacity`}
            aria-label="Change font size"
            title="Font size"
          >
            <Type className="h-4 w-4" />
          </button>
          <button
            onClick={cycleTheme}
            className={`p-2 rounded-full ${themeClasses.surface} hover:opacity-80 transition-opacity`}
            aria-label="Change theme"
            title="Theme"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className={`p-2 rounded-full ${themeClasses.surface} hover:opacity-80 transition-opacity`}
            aria-label="Close reading mode"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className={`h-1 ${themeClasses.surface}`}>
        <div
          className="h-full bg-current transition-all duration-300"
          style={{ width: `${progress}%`, opacity: 0.5 }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {image && (
            <img
              src={image}
              alt=""
              className="w-full max-h-[40vh] object-cover rounded-2xl mb-8 shadow-md"
              loading="lazy"
            />
          )}
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${themeClasses.muted}`}>
            {safeIdx + 1} / {total}
          </p>
          <div className={`whitespace-pre-wrap font-medium ${SIZE_CLASSES[size]}`}>{text}</div>
        </article>
      </main>

      {/* Bottom navigation */}
      <footer className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-current/10`}>
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={safeIdx === 0}
          className={`px-4 py-2 rounded-full font-bold inline-flex items-center gap-1 ${themeClasses.surface} disabled:opacity-30`}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <div className="flex items-center gap-1.5">
          {chapters.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Page ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === safeIdx ? "bg-current w-6 opacity-80" : "bg-current w-2 opacity-30"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
          disabled={safeIdx === total - 1}
          className={`px-4 py-2 rounded-full font-bold inline-flex items-center gap-1 ${themeClasses.surface} disabled:opacity-30`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </footer>
    </div>
  );
};

export default ReadingMode;
