import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Loader2, X, Download } from "lucide-react";
import { renderStoryVideo, downloadBlob } from "@/lib/storyVideoExport";
import { toast } from "sonner";

export interface StoryVideoPage {
  text: string;
  image_url?: string | null;
}

interface StoryVideoPlayerProps {
  open: boolean;
  onClose: () => void;
  audioUrl: string;
  pages: StoryVideoPage[];
  /** Word-weights per page from narrate-story-full. If omitted, equal weights. */
  pageWeights?: number[];
  title?: string;
}

/**
 * Slideshow video player: plays stitched audio while syncing page slides
 * based on per-page weights (or equal time if not provided).
 * Renders as a full-screen modal.
 */
const StoryVideoPlayer = ({
  open,
  onClose,
  audioUrl,
  pages,
  pageWeights,
  title,
}: StoryVideoPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportPct(0);
    try {
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
      const blob = await renderStoryVideo({
        audioUrl, pages, pageWeights, title,
        onProgress: (p) => setExportPct(Math.round(p * 100)),
      });
      const safe = (title || "story").replace(/[^a-z0-9-_ ]/gi, "").trim() || "story";
      downloadBlob(blob, `${safe}.webm`);
      toast.success("Video downloaded 🎬");
    } catch (e) {
      console.error(e);
      toast.error("Video export failed — try a desktop browser.");
    } finally {
      setExporting(false);
    }
  };

  // Normalize weights → cumulative time markers per page
  const markers = useMemo(() => {
    if (pages.length === 0 || duration === 0) return [] as number[];
    const w = (pageWeights && pageWeights.length === pages.length
      ? pageWeights
      : pages.map(() => 1));
    const total = w.reduce((s, n) => s + n, 0) || 1;
    let acc = 0;
    return w.map((x) => {
      acc += x / total;
      return acc * duration;
    });
  }, [pages, pageWeights, duration]);

  const currentPageIdx = useMemo(() => {
    if (markers.length === 0) return 0;
    for (let i = 0; i < markers.length; i++) {
      if (currentTime < markers[i]) return i;
    }
    return markers.length - 1;
  }, [markers, currentTime]);

  useEffect(() => {
    if (!open) return;
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => {
      setDuration(a.duration || 0);
      setIsLoading(false);
    };
    const onTime = () => setCurrentTime(a.currentTime);
    const onEnd = () => setIsPlaying(false);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [open]);

  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [open]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const seekToPage = (idx: number) => {
    const a = audioRef.current;
    if (!a) return;
    const startMarker = idx === 0 ? 0 : markers[idx - 1] ?? 0;
    a.currentTime = startMarker + 0.05;
    setCurrentTime(a.currentTime);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  const page = pages[currentPageIdx];

  return (
    <div className="fixed inset-0 z-[100] bg-kids-midnight/95 backdrop-blur-sm flex flex-col">
      <header className="flex items-center justify-between p-4 text-white gap-3">
        <h2 className="font-extrabold truncate flex-1">{title}</h2>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="h-10 px-4 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground flex items-center gap-2 text-sm font-bold disabled:opacity-50"
          aria-label="Download video"
        >
          {exporting ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{exportPct}%</>
          ) : (
            <><Download className="h-4 w-4" />Video</>
          )}
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 gap-4 overflow-hidden">
        {page?.image_url ? (
          <img
            src={page.image_url}
            alt=""
            className="max-h-[55vh] w-auto rounded-3xl object-contain shadow-glow border-4 border-white/20"
          />
        ) : (
          <div className="h-48 w-full max-w-md rounded-3xl bg-white/5 border-4 border-white/10" />
        )}

        <p className="text-white/90 text-center max-w-2xl text-lg leading-relaxed line-clamp-4">
          {page?.text}
        </p>

        <div className="text-xs text-white/60 font-mono">
          {currentPageIdx + 1} / {pages.length}
        </div>
      </div>

      <footer className="p-4 bg-black/40">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3 text-white/80 text-xs font-mono">
            <span>{fmt(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (audioRef.current) {
                  audioRef.current.currentTime = v;
                  setCurrentTime(v);
                }
              }}
              className="flex-1 accent-primary"
            />
            <span>{fmt(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => seekToPage(Math.max(0, currentPageIdx - 1))}
              disabled={currentPageIdx === 0}
              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
              aria-label="Previous page"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center hover-pop disabled:opacity-50"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Play className="h-7 w-7 ms-1" />
              )}
            </button>

            <button
              onClick={() => seekToPage(Math.min(pages.length - 1, currentPageIdx + 1))}
              disabled={currentPageIdx >= pages.length - 1}
              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30"
              aria-label="Next page"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>
      </footer>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </div>
  );
};

export default StoryVideoPlayer;
