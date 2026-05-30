// Page-by-page SEL story viewer (Phase 3 UI + Phase 4 illustrations).
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Image as ImageIcon, Loader2, Download, Lock, Volume2, Pause, Square } from "lucide-react";
import type { SelStoryResponse, SelStoryPage } from "@/lib/selStoryApi";
import { illustrateSelStory, exportStoryPdf, SubscriptionRequiredError } from "@/lib/selStoryApi";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { speakWithBrowser, type BrowserTtsHandle } from "@/lib/browserTts";
import { handleEdgeError } from "@/lib/edgeErrors";
import PremiumBadge from "@/components/PremiumBadge";

interface Props {
  story: SelStoryResponse;
  onBack: () => void;
}

export const SelStoryViewer = ({ story, onBack }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { canIllustrate, canExportPdf, canAudio, tier, loading: subLoading } = useSubscription();
  const [pages, setPages] = useState<SelStoryPage[]>(story.pages);
  const [idx, setIdx] = useState(0);
  const [illustrating, setIllustrating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageStatus, setPageStatus] = useState<Record<number, "idle" | "pending" | "ready" | "failed">>({});
  const [pageError, setPageError] = useState<Record<number, string | undefined>>({});
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | BrowserTtsHandle | null>(null);
  // Cached playback position so pause → play resumes exactly where we left off,
  // even if the browser drops the decoded buffer for a data: URL.
  const audioPositionRef = useRef<number>(0);
  const page = pages[idx];

  const currentPath = `${location.pathname}${location.search}`;
  const goAuth = () => navigate("/auth", { state: { from: currentPath } });
  const goPricing = () => navigate("/pricing", { state: { from: currentPath } });

  const requireSubscription = (feature: "illustrate" | "pdf" | "audio"): boolean => {
    if (!user) {
      toast.error(t("paywall.sign_in_required", "Sign in to unlock this feature"), {
        action: { label: t("paywall.sign_in_cta", "Sign in"), onClick: goAuth },
      });
      return false;
    }
    if (subLoading) {
      toast.message(t("paywall.checking_subscription", "Checking your subscription…"));
      return false;
    }
    const allowed =
      feature === "illustrate" ? canIllustrate : feature === "pdf" ? canExportPdf : canAudio;
    if (!allowed) {
      toast.error(t("paywall.feature_requires_paid", "This feature requires a paid plan"), {
        description: tier === "free"
          ? t("paywall.free_upgrade_desc", "Upgrade to unlock illustrations, PDF, and audio narration.")
          : t("paywall.feature_not_in_plan", "Your current plan does not include this feature."),
        action: { label: t("paywall.upgrade_cta", "Upgrade"), onClick: goPricing },
      });
      return false;
    }
    return true;
  };


  const runIllustrate = async (targetPages: SelStoryPage[]) => {
    if (!requireSubscription("illustrate")) return;
    if (!story.story_id) {
      toast.error("Sign in to generate illustrations");
      return;
    }
    setIllustrating(true);
    setPageStatus((s) => {
      const n = { ...s };
      targetPages.forEach((p) => (n[p.index] = "pending"));
      return n;
    });
    try {
      const res = await illustrateSelStory({
        storyId: story.story_id,
        pages: targetPages.map((p) => ({
          index: p.index,
          illustrationPrompt: p.illustrationPrompt,
          emotionTag: p.emotionTag,
        })),
        characterVisualHash: story.character_visual_hash,
        characterProfile: (story.blueprint as { hero?: Record<string, unknown> } | undefined)?.hero ?? null,
      });
      const map = new Map(res.illustrations.map((i) => [i.index, i]));
      setPages((prev) => prev.map((p) => {
        const r = map.get(p.index);
        return r?.imageUrl ? { ...p, imageUrl: r.imageUrl } : p;
      }));
      setPageStatus((s) => {
        const n = { ...s };
        res.illustrations.forEach((r) => (n[r.index] = r.status === "ready" ? "ready" : "failed"));
        return n;
      });
      setPageError((s) => {
        const n = { ...s };
        res.illustrations.forEach((r) => (n[r.index] = r.error));
        return n;
      });
      const failed = res.illustrations.filter((r) => r.status !== "ready").length;
      if (failed === 0) toast.success("Illustrations ready");
      else toast.warning(`${res.illustrations.length - failed} ready, ${failed} failed`);
    } catch (e) {
      console.error(e);
      if (e instanceof SubscriptionRequiredError) {
        toast.error(t("paywall.feature_requires_paid", "This feature requires a paid plan"), {
          description: t("paywall.illustrations", "Illustrations"),
          action: { label: t("paywall.upgrade_cta", "Upgrade"), onClick: goPricing },
        });
      } else {
        await handleEdgeError(e, t, { context: "illustrate-story" });
      }
      setPageStatus((s) => {
        const n = { ...s };
        targetPages.forEach((p) => (n[p.index] = "failed"));
        return n;
      });
    } finally {
      setIllustrating(false);
    }
  };

  const handleIllustrate = () => runIllustrate(pages);
  const handleRetryPage = () => runIllustrate([page]);

  // Auto-generate illustrations as soon as the story arrives, if the user is allowed.
  // This removes the manual "click Illustrate" step so images appear with the story.
  const autoIllustratedRef = useRef(false);
  useEffect(() => {
    if (autoIllustratedRef.current) return;
    if (subLoading) return;
    if (!user || !canIllustrate) return;
    if (!story.story_id) return;
    if (pages.some((p) => p.imageUrl)) { autoIllustratedRef.current = true; return; }
    autoIllustratedRef.current = true;
    runIllustrate(pages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLoading, canIllustrate, user, story.story_id]);

  const handleExportPdf = async () => {
    if (!requireSubscription("pdf")) return;
    if (!story.story_id) {
      toast.error("Sign in to download PDF");
      return;
    }
    setExporting(true);
    try {
      const url = await exportStoryPdf(story.story_id);
      window.open(url, "_blank");
      toast.success("PDF ready");
    } catch (e) {
      console.error(e);
      if (e instanceof SubscriptionRequiredError) {
        toast.error(t("paywall.feature_requires_paid", "This feature requires a paid plan"), {
          description: t("paywall.pdf", "PDF Download"),
          action: { label: t("paywall.upgrade_cta", "Upgrade"), onClick: goPricing },
        });
      } else {
        await handleEdgeError(e, t, { context: "export-story-pdf" });
      }
    } finally {
      setExporting(false);
    }
  };

  const stopNarration = () => {
    if (audioRef.current) {
      if ("cancel" in audioRef.current) {
        audioRef.current.cancel();
      } else {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      audioRef.current = null;
    }
    audioPositionRef.current = 0;
    setAudioState("idle");
  };

  const handleNarrate = async () => {
    if (audioState === "playing") {
      if (audioRef.current && !("cancel" in audioRef.current)) {
        // HTMLAudioElement → remember position before pausing.
        audioPositionRef.current = audioRef.current.currentTime;
        audioRef.current.pause();
      } else {
        audioRef.current?.pause();
      }
      setAudioState("paused");
      return;
    }
    if (audioState === "idle" && !requireSubscription("audio")) return;
    if (audioState === "paused") {
      if (audioRef.current && "resume" in audioRef.current) {
        audioRef.current.resume();
      } else if (audioRef.current && "play" in audioRef.current) {
        try {
          if (audioPositionRef.current > 0) {
            audioRef.current.currentTime = audioPositionRef.current;
          }
        } catch {
          /* currentTime assignment can throw before metadata loads */
        }
        audioRef.current.play().catch(() => {});
      }
      setAudioState("playing");
      return;
    }
    if (!requireSubscription("audio")) return;
    setAudioState("loading");
    try {
      const fullText = pages.map((p) => p.text).join("\n\n");
      const isArabic = /[\u0600-\u06FF]/.test(fullText);
      const { data, error } = await supabase.functions.invoke("narrate-story", {
        body: { text: fullText, language: isArabic ? "ar" : "en", character: "fairy" },
      });
      if (error) throw error;
      if (data?.fallback || !data?.audioContent) {
        const browserHandle = await speakWithBrowser({
          text: fullText,
          language: isArabic ? "ar" : "en",
          character: "fairy",
          ageId: story.age_band,
          onEnd: () => {
            audioRef.current = null;
            setAudioState("idle");
          },
          onError: () => {
            audioRef.current = null;
            setAudioState("idle");
            toast.error("Narration failed");
          },
        });
        audioRef.current = browserHandle;
        setAudioState("playing");
        return;
      }

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audio.onended = () => {
        audioRef.current = null;
        audioPositionRef.current = 0;
        setAudioState("idle");
      };
      audio.onerror = () => {
        audioRef.current = null;
        audioPositionRef.current = 0;
        setAudioState("idle");
        toast.error("Playback failed");
      };
      audioPositionRef.current = 0;
      audioRef.current = audio;
      await audio.play();
      setAudioState("playing");
    } catch (e) {
      console.error(e);
      await handleEdgeError(e, t, { context: "narrate-story" });
      setAudioState("idle");
    }
  };

  return (
    <div className="bg-white dark:bg-white/10 backdrop-blur-md border border-foreground/10 dark:border-white/20 rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-foreground dark:text-white">{story.title}</h3>
          <p className="text-xs text-muted-foreground dark:text-white/70 font-semibold mt-1">
            {story.sel_outcome.statement}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" />
            SEL {story.quality.total}/25
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            {story.sel_outcome.skill}
          </span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-foreground/10 dark:border-white/15 bg-kids-softYellow/30 dark:bg-white/5">
        {page.imageUrl ? (
          <img src={page.imageUrl} alt={page.illustrationPrompt} className="w-full max-h-[420px] object-cover" />
        ) : pageStatus[page.index] === "pending" ? (
          <div className="w-full h-44 sm:h-56 flex flex-col items-center justify-center gap-2 text-primary text-sm font-semibold">
            <Loader2 className="h-6 w-6 animate-spin" />
            Generating illustration…
          </div>
        ) : pageStatus[page.index] === "failed" ? (
          <div className="w-full h-44 sm:h-56 flex flex-col items-center justify-center gap-2 text-destructive text-sm font-semibold p-4 text-center">
            <ImageIcon className="h-5 w-5" />
            <span>Illustration failed{pageError[page.index] ? ` (${pageError[page.index]})` : ""}</span>
            <button
              onClick={handleRetryPage}
              disabled={illustrating}
              className="mt-1 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
            >
              <Loader2 className={`h-3 w-3 ${illustrating ? "animate-spin" : "hidden"}`} />
              Retry
            </button>
          </div>
        ) : (
          <div className="w-full h-44 sm:h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground dark:text-white/70 text-sm font-semibold p-4 text-center">
            <ImageIcon className="h-6 w-6 opacity-70" />
            <span>{canIllustrate ? "Tap “Illustrate” to draw this scene" : "Illustrations unlock with a subscription"}</span>
            {canIllustrate && (
              <button
                onClick={handleIllustrate}
                disabled={illustrating}
                className="mt-1 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
              >
                {illustrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Illustrate
              </button>
            )}
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground dark:text-white/70 mb-2">
            <span>Page {page.index} / {pages.length}</span>
            <span className="uppercase tracking-wide">{page.emotionTag}{page.bibliotherapyStage ? ` · ${page.bibliotherapyStage}` : ""}</span>
          </div>
          <p className="text-base sm:text-lg leading-relaxed text-foreground dark:text-white font-semibold whitespace-pre-wrap">
            {page.text}
          </p>
          {(page.visualPrompt || page.animationPrompt || page.voiceOver || page.dialogue || page.soundEffects || page.backgroundMusic || page.imagePrompt || page.videoPrompt) && (
            <details className="mt-4 group rounded-lg border border-foreground/10 dark:border-white/15 bg-foreground/5 dark:bg-white/5 p-3">
              <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide text-primary dark:text-amber-200 select-none">
                🎬 Cinematic Scene Details
              </summary>
              <div className="mt-3 space-y-2 text-xs sm:text-sm text-foreground dark:text-white/90">
                {page.voiceOver && <p><strong className="text-primary dark:text-amber-200">🎙️ Voice-Over:</strong> {page.voiceOver}</p>}
                {page.dialogue && <p><strong className="text-primary dark:text-amber-200">💬 Dialogue:</strong> {page.dialogue}</p>}
                {page.visualPrompt && <p><strong className="text-primary dark:text-amber-200">🖼️ Visual:</strong> {page.visualPrompt}</p>}
                {page.animationPrompt && <p><strong className="text-primary dark:text-amber-200">🎥 Animation:</strong> {page.animationPrompt}</p>}
                {page.soundEffects && <p><strong className="text-primary dark:text-amber-200">🔊 SFX:</strong> {page.soundEffects}</p>}
                {page.backgroundMusic && <p><strong className="text-primary dark:text-amber-200">🎵 Music:</strong> {page.backgroundMusic}</p>}
                {page.imagePrompt && <p className="font-mono text-[11px] sm:text-xs"><strong className="text-primary dark:text-amber-200 font-sans">🪄 Image Prompt:</strong> {page.imagePrompt}</p>}
                {page.videoPrompt && <p className="font-mono text-[11px] sm:text-xs"><strong className="text-primary dark:text-amber-200 font-sans">🎞️ Video Prompt:</strong> {page.videoPrompt}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="px-4 py-2 rounded-full bg-muted dark:bg-white/10 font-bold text-foreground dark:text-white disabled:opacity-40 inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <div className="flex gap-1">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Page ${i + 1}`}
              className={`h-2 w-2 rounded-full ${i === idx ? "bg-primary w-6" : "bg-foreground/20 dark:bg-white/30"} transition-all`}
            />
          ))}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(pages.length - 1, i + 1))}
          disabled={idx === pages.length - 1}
          className="px-4 py-2 rounded-full bg-muted dark:bg-white/10 font-bold text-foreground dark:text-white disabled:opacity-40 inline-flex items-center gap-1"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {/* AUDIO — Premium tier only */}
        {canAudio ? (
          <>
            <button
              onClick={handleNarrate}
              disabled={audioState === "loading"}
              className="px-6 py-3 bg-amber-400 text-kids-midnight rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-70"
            >
              {audioState === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : audioState === "playing" ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              {audioState === "loading"
                ? "Loading…"
                : audioState === "playing"
                ? "Pause"
                : audioState === "paused"
                ? "Resume"
                : "Listen to Story"}
            </button>
            {(audioState === "playing" || audioState === "paused") && (
              <button
                onClick={stopNarration}
                className="px-4 py-3 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full font-bold shadow inline-flex items-center gap-2"
                title="Stop"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            )}
          </>
        ) : (
          <PremiumBadge featureKey="audio" size="lg" />
        )}

        {/* ILLUSTRATE + PDF — Family / Premium tiers */}
        {canIllustrate && canExportPdf ? (
          <button
            onClick={async () => {
              await runIllustrate(pages);
              if (!requireSubscription("pdf")) return;
              await handleExportPdf();
            }}
            disabled={illustrating || exporting}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-70"
          >
            {illustrating || exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {illustrating ? "Illustrating…" : exporting ? "Exporting…" : "Illustrate & Download"}
          </button>
        ) : (
          <PremiumBadge featureKey="illustrations" size="lg" />
        )}

        <button
          onClick={onBack}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-full font-bold shadow border border-foreground/10 dark:border-white/20"
        >
          Create Another
        </button>
      </div>
    </div>
  );
};

export default SelStoryViewer;
