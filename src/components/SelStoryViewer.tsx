// Page-by-page SEL story viewer (Phase 3 UI + Phase 4 illustrations).
import { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck, Image as ImageIcon, Loader2, Download, Volume2, Pause, Square, RefreshCw } from "lucide-react";
import type { SelStoryResponse, SelStoryPage } from "@/lib/selStoryApi";
import { illustrateSelStory, exportStoryPdf, SubscriptionRequiredError } from "@/lib/selStoryApi";
import { generateStoryMp3, downloadStoryMp3, StoryMp3Error } from "@/lib/storyTtsApi";

import { recordIllustrationMetric } from "@/lib/illustrationMetrics";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { speakWithBrowser, type BrowserTtsHandle } from "@/lib/browserTts";
import { logAudio } from "@/lib/audioDebug";
import { handleEdgeError } from "@/lib/edgeErrors";
import PremiumBadge from "@/components/PremiumBadge";
import { normalizeApiError } from "@/lib/apiErrorNormalization";

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
  const [mp3Loading, setMp3Loading] = useState(false);

  const [pageStatus, setPageStatus] = useState<Record<number, "idle" | "pending" | "ready" | "failed">>({});
  const [pageError, setPageError] = useState<Record<number, string | undefined>>({});
  // Non-blocking illustration failure notice. The story text always stays
  // readable; this only offers an explicit, user-triggered retry for the pages
  // that still have no picture.
  const [illustrationError, setIllustrationError] = useState<string | null>(null);

  // Per-page queued/started timestamps surfaced in the progress strip tooltip
  // so users can see exactly when an illustration entered each phase.
  const [pageQueuedAt, setPageQueuedAt] = useState<Record<number, number>>(() =>
    Object.fromEntries(story.pages.map((p) => [p.index, Date.now()])),
  );
  const [pageStartedAt, setPageStartedAt] = useState<Record<number, number>>({});
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | BrowserTtsHandle | null>(null);
  // Cached playback position so pause → play resumes exactly where we left off,
  // even if the browser drops the decoded buffer for a data: URL.
  const audioPositionRef = useRef<number>(0);
  // Client-side dedup: any (storyId,pageIndex) currently being illustrated is
  // tracked here. Repeated Retry presses for the same page are no-ops while a
  // job is in-flight — this prevents duplicate edge function calls / charges.
  const inFlightPagesRef = useRef<Set<number>>(new Set());
  // Polite, screen-reader-only announcer for status transitions and toast
  // phases (queued / generating / page X ready / page X failed). Mirrors the
  // toast lifecycle so blind users get the same progress narrative.
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
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


  const runIllustrate = async (
    targetPages: SelStoryPage[],
  ): Promise<{ ok: boolean; readyIndexes: number[] }> => {
    if (!requireSubscription("illustrate")) return { ok: false, readyIndexes: [] };
    if (!story.story_id) {
      toast.error("Sign in to generate illustrations");
      return { ok: false, readyIndexes: [] };
    }
    // Idempotency / dedup — drop pages already being illustrated. If the user
    // mashes Retry the second press becomes a no-op (no duplicate jobs).
    const pending = targetPages.filter((p) => !inFlightPagesRef.current.has(p.index));
    if (pending.length === 0) {
      toast.message(t("sel.illustrations_already_running", "Illustration already in progress"));
      return { ok: false, readyIndexes: [] };
    }
    pending.forEach((p) => inFlightPagesRef.current.add(p.index));



    const batchKey = `illustrate:${story.story_id}:${pending.map((p) => p.index).join(",")}`;
    // Idempotency key: stable for this batch so a server with dedup support can
    // reject duplicate posts and the UI can correlate toasts.
    const idempotencyKey = `${story.story_id}:${pending
      .map((p) => p.index)
      .join("-")}:${Date.now()}`;

    setIllustrating(true);
    setIllustrationError(null);
    const queuedAt = Date.now();
    setPageQueuedAt((s) => {
      const n = { ...s };
      pending.forEach((p) => (n[p.index] = queuedAt));
      return n;
    });
    setPageStatus((s) => {
      const n = { ...s };
      pending.forEach((p) => (n[p.index] = "pending"));
      return n;
    });
    const startedAt = Date.now();
    setPageStartedAt((s) => {
      const n = { ...s };
      pending.forEach((p) => (n[p.index] = startedAt));
      return n;
    });
    setLiveAnnouncement(
      t("sel.live_queued", `Queued ${pending.length} illustration${pending.length === 1 ? "" : "s"}.`),
    );
    pending.forEach((p) =>
      recordIllustrationMetric({
        event: "queued",
        storyId: story.story_id!,
        idempotencyKey,
        pageIndex: p.index,
        source: "SelStoryViewer",
      }),
    );
    // Toast lifecycle: queued → generating → success/error. Same id so each
    // phase replaces the prior toast instead of stacking.
    toast.message(
      t("sel.toast_queued", `Queued ${pending.length} illustration${pending.length === 1 ? "" : "s"}`),
      { id: batchKey, description: t("sel.toast_queued_desc", "Sending request to the AI illustrator…") },
    );
    setTimeout(() => {
      if (inFlightPagesRef.current.size > 0) {
        toast.loading(
          t("sel.toast_generating", `Generating ${pending.length} illustration${pending.length === 1 ? "" : "s"}…`),
          { id: batchKey },
        );
        setLiveAnnouncement(
          t("sel.live_generating", `Generating ${pending.length} illustration${pending.length === 1 ? "" : "s"}.`),
        );
        recordIllustrationMetric({
          event: "generating",
          storyId: story.story_id!,
          idempotencyKey,
          source: "SelStoryViewer",
        });
      }
    }, 250);
    try {
      console.info("[SelStoryViewer] illustrate requested by user", {
        storyId: story.story_id,
        pages: pending.map((p) => p.index),
        startedAt,
        idempotencyKey,
      });
      const res = await illustrateSelStory({
        storyId: story.story_id,
        pages: pending.map((p) => ({
          index: p.index,
          // Prompt derives from the canonical page content only.
          illustrationPrompt: (p.illustrationPrompt || p.text || "").trim().slice(0, 600),
          emotionTag: p.emotionTag,
          text: p.text,
        })),
        characterVisualHash: story.character_visual_hash,
        characterProfile: (story.blueprint as { hero?: Record<string, unknown> } | undefined)?.hero ?? null,
        idempotencyKey,
      }, { trigger: "user", source: "SelStoryViewer.runIllustrate" });

      const latencyMs = Date.now() - startedAt;
      if ((res as { idempotent?: boolean }).idempotent) {
        recordIllustrationMetric({
          event: "idempotent_replay",
          storyId: story.story_id!,
          idempotencyKey,
          latencyMs,
          source: "SelStoryViewer",
        });
      }

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
      res.illustrations.forEach((r) =>
        recordIllustrationMetric({
          event: r.status === "ready" ? "complete" : "failed",
          storyId: story.story_id!,
          idempotencyKey,
          pageIndex: r.index,
          status: r.status,
          error: r.error,
          latencyMs,
          source: "SelStoryViewer",
        }),
      );
      const failed = res.illustrations.filter((r) => r.status !== "ready").length;
      if (failed === 0) {
        setIllustrationError(null);
        toast.success(t("sel.toast_success", "Illustrations ready"), { id: batchKey });
        setLiveAnnouncement(
          t("sel.live_all_ready", `All ${res.illustrations.length} illustrations are ready.`),
        );
      } else {
        // Quiet partial-fail: no scary red toast. Users see the neutral
        // placeholder on affected pages and can tap Illustrate again.
        console.info("[illustrate-story] partial fail", { ready: res.illustrations.length - failed, failed });
        setIllustrationError(
          t(
            "sel.illustrations_partial_failed",
            "Some pictures couldn't be drawn. Your story is safe — you can try again.",
          ),
        );
        setLiveAnnouncement(
          t("sel.live_partial", `${res.illustrations.length - failed} ready, ${failed} pending. Tap Illustrate to retry.`),
        );
      }
      return {
        ok: failed === 0,
        readyIndexes: res.illustrations.filter((r) => r.status === "ready" && !!r.imageUrl).map((r) => r.index),
      };
    } catch (e) {

      console.error(e);
      if (e instanceof SubscriptionRequiredError) {
        toast.error(t("paywall.feature_requires_paid", "This feature requires a paid plan"), {
          id: batchKey,
          description: t("paywall.illustrations", "Illustrations"),
          action: { label: t("paywall.upgrade_cta", "Upgrade"), onClick: goPricing },
        });
      } else {
        // Quiet hard-fail: log for debugging but don't surface the scary
        // "Illustration job failed" toast to end users.
        console.warn("[illustrate-story] job failed", e);
        const normalized = normalizeApiError(e, t).message;
        setIllustrationError(normalized);
        // Replace the in-progress toast so the UI can never stay stuck on
        // "Generating illustrations…" after a 4xx/5xx response.
        toast.error(normalized, { id: batchKey });
      }
      setPageStatus((s) => {
        const n = { ...s };
        pending.forEach((p) => (n[p.index] = "failed"));
        return n;
      });
      pending.forEach((p) =>
        recordIllustrationMetric({
          event: "failed",
          storyId: story.story_id!,
          idempotencyKey,
          pageIndex: p.index,
          error: e instanceof Error ? e.message : "unknown",
          source: "SelStoryViewer",
        }),
      );
      setLiveAnnouncement(
        t("sel.live_failed", "Illustration job failed. You can retry."),
      );
      return { ok: false, readyIndexes: [] };
    } finally {

      pending.forEach((p) => inFlightPagesRef.current.delete(p.index));
      setIllustrating(false);
      setPageStatus((s) => {
        const n = { ...s };
        pending.forEach((p) => {
          if (n[p.index] === "pending") n[p.index] = "failed";
        });
        return n;
      });
    }
  };

  const handleIllustrate = () => runIllustrate(pages);
  /**
   * Explicit user retry after a failed illustration run. Only pages that still
   * have no picture are re-requested, and the story text is never unmounted or
   * hidden while this runs.
   */
  const handleRetryIllustrations = () => {
    const missing = pages.filter((p) => !p.imageUrl);
    runIllustrate(missing.length ? missing : pages);
  };
  const handleRetryPage = () => runIllustrate([page]);


  const handleExportPdf = async () => {
    if (!requireSubscription("pdf")) return;
    if (!story.story_id) {
      toast.error("Sign in to download PDF");
      return;
    }
    const missing = pages.filter((candidate) => !candidate.imageUrl);
    if (missing.length > 0 || illustrating) {
      toast.info(t("sel.pdf_waiting_for_illustrations", `Your illustrated story is still preparing (${pages.length - missing.length}/${pages.length}).`));
      return;
    }
    setExporting(true);
    try {
      // Rebuild from this story's current illustrations instead of returning a
      // cached text-only export created before illustration completed.
      const url = await exportStoryPdf(story.story_id, { force: true });
      // Anchor-based download: window.open() after an await is treated as an
      // unrequested popup by published-site popup blockers, so the file never
      // reached the customer. An <a download> click always starts the download.
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(story.title || "story").replace(/[^\w\u0600-\u06FF -]/g, "").trim() || "story"}.pdf`;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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

  const handleDownloadMp3 = async () => {
    if (!user) {
      toast.error(t("paywall.sign_in_required", "Sign in to unlock this feature"), {
        action: { label: t("paywall.sign_in_cta", "Sign in"), onClick: goAuth },
      });
      return;
    }
    setMp3Loading(true);
    try {
      const fullText = pages.map((p) => p.text).join("\n\n");
      const isArabic = /[\u0600-\u06FF]/.test(fullText);
      const res = await generateStoryMp3(
        {
          text: fullText,
          language: isArabic ? "ar" : "en",
          storyId: story.story_id ?? undefined,
        },
        {
          onProgress: (evt) => {
            if (evt.phase === "generating") toast.info(evt.message, { id: "mp3-progress" });
            if (evt.phase === "retrying") toast.warning(evt.message, { id: "mp3-progress" });
            if (evt.phase === "cached") toast.success(evt.message, { id: "mp3-progress" });
          },
        },
      );
      const safe = (story.title || "story").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "story";
      await downloadStoryMp3(res.url, `${safe}.mp3`);
      toast.success(t("sel.mp3_ready", "Audio MP3 downloaded 🎧"));
    } catch (e) {
      const msg = e instanceof StoryMp3Error ? e.message : t("sel.mp3_failed", "Could not build the audio.");
      toast.error(msg);
    } finally {
      setMp3Loading(false);
    }
  };


  const handleNarrate = async () => {
    if (audioState === "playing") {
      logAudio({ source: "SelViewer/TTS", kind: "pause" });
      audioRef.current?.pause();
      setAudioState("paused");
      return;
    }
    if (audioState === "paused") {
      if (audioRef.current && "resume" in audioRef.current) {
        logAudio({ source: "SelViewer/TTS", kind: "resume-playing" });
        audioRef.current.resume();
        setAudioState("playing");
      }
      return;
    }
    setAudioState("loading");
    try {
      const { isBrowserTtsSupported } = await import("@/lib/browserTts");
      if (!isBrowserTtsSupported()) {
        toast.error(
          t(
            "narrator.unsupported",
            "Your browser doesn't support built-in narration. Please try the latest Chrome, Edge, Safari, or Firefox.",
          ),
        );
        setAudioState("idle");
        return;
      }
      const fullText = pages.map((p) => p.text).join("\n\n");
      const isArabic = /[\u0600-\u06FF]/.test(fullText);
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
          toast.error(t("narrator.playback_failed", "Narration failed"));
        },
      });
      audioRef.current = browserHandle;
      setAudioState("playing");
    } catch (e) {
      console.error(e);
      setAudioState("idle");
      toast.error(t("narrator.playback_failed", "Narration failed"));
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
          {story.quality.total > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              SEL {story.quality.total}/25
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            {story.sel_outcome.skill}
          </span>
        </div>
      </div>


      <div className="rounded-xl overflow-hidden border border-foreground/10 dark:border-white/15 bg-kids-softYellow/30 dark:bg-white/5">
        {page.imageUrl ? (
          <div className="relative group">
            <img src={page.imageUrl} alt={page.illustrationPrompt} className="w-full max-h-[420px] object-cover" />
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const res = await fetch(page.imageUrl!, { mode: "cors" });
                  const blob = await res.blob();
                  const ext = (blob.type.split("/")[1] || "png").split("+")[0];
                  const filename = `story-page-${page.index}.${ext}`;

                  // Force a direct file download — no browser tab, no share sheet.
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.rel = "noopener";
                  a.style.display = "none";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 4000);
                } catch (err) {
                  console.warn("[sel] image download failed", err);
                  toast.error(t("sel.download_image_failed", "Could not save the image."));
                }
              }}
              className="absolute top-2 end-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-bold shadow backdrop-blur-sm"
              title={t("sel.download_image", "Download image")}
            >
              <Download className="h-3.5 w-3.5" />
              {t("sel.download_image_short", "Save")}
            </button>
          </div>
        ) : pageStatus[page.index] === "pending" ? (
          <div className="w-full h-44 sm:h-56 flex flex-col items-center justify-center gap-2 text-primary text-sm font-semibold">
            <Loader2 className="h-6 w-6 animate-spin" />
            {t("sel.generating_illustration", "Generating illustration…")}
          </div>
        ) : (
          // Neutral placeholder — used both when no illustration has been
          // requested yet AND when a previous attempt failed. Failures are
          // handled silently (no red error card, no scary toast); the user
          // simply taps the button again to try once more.
          <div className="w-full h-44 sm:h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground dark:text-white/70 text-sm font-semibold p-4 text-center">
            <ImageIcon className="h-6 w-6 opacity-70" />
            <span>{canIllustrate ? t("sel.tap_to_draw", "Tap “Illustrate” to draw this scene") : t("sel.illustrations_locked", "Illustrations unlock with a subscription")}</span>
            {canIllustrate && (
              <button
                onClick={pageStatus[page.index] === "failed" ? handleRetryPage : handleIllustrate}
                disabled={illustrating}
                className="mt-1 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-60"
              >
                {illustrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {t("sel.illustrate", "Illustrate")}
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

      {/* Illustration readiness summary — surfaces Function B state to the user. */}
      {(() => {
        const ready = pages.filter((p) => !!p.imageUrl).length;
        const total = pages.length;
        const allReady = ready === total && total > 0;
        const pendingCount = Object.values(pageStatus).filter((s) => s === "pending").length;
        return (
          <div className="mt-4 flex flex-col items-center gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5 text-foreground/60 dark:text-white/60" />
              <span
                data-testid="illustration-readiness-badge"
                className={`px-2 py-0.5 rounded-full font-semibold ${
                  allReady
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : ready > 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-foreground/10 text-foreground/70 dark:text-white/70"
                }`}
                aria-live="polite"
              >
                {illustrating
                  ? t("sel.illustrations_pending", `Generating illustrations… ${ready}/${total}`)
                  : allReady
                  ? t("sel.illustrations_ready", `All illustrations ready (${total}/${total})`)
                  : t("sel.illustrations_status", `Illustrations: ${ready}/${total} ready`)}
              </span>
            </div>
            {/* Per-page progress dots: queued / generating / complete / error */}
            <div className="flex flex-wrap gap-1 justify-center" data-testid="illustration-progress-strip">
              {pages.map((p) => {
                const status = p.imageUrl
                  ? "complete"
                  : pageStatus[p.index] === "pending"
                  ? "generating"
                  : pageStatus[p.index] === "failed"
                  ? "error"
                  : "queued";
                const cls =
                  status === "complete"
                    ? "bg-emerald-500"
                    : status === "generating"
                    ? "bg-primary animate-pulse"
                    : status === "error"
                    ? "bg-foreground/20 dark:bg-white/30"
                    : "bg-foreground/20 dark:bg-white/30";
                const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleTimeString() : "—");
                const tip =
                  `Page ${p.index}: ${status}` +
                  ` · queued ${fmt(pageQueuedAt[p.index])}` +
                  (pageStartedAt[p.index] ? ` · started ${fmt(pageStartedAt[p.index])}` : "") +
                  (pageError[p.index] ? ` — ${pageError[p.index]}` : "");
                return (
                  <span
                    key={p.index}
                    data-testid={`illustration-page-${p.index}`}
                    data-status={status}
                    data-queued-at={pageQueuedAt[p.index] ?? ""}
                    data-started-at={pageStartedAt[p.index] ?? ""}
                    title={tip}
                    role="img"
                    aria-label={t("sel.page_status_aria", `Page ${p.index} ${status}`)}
                    className={`h-2 w-4 rounded-sm ${cls}`}
                  />
                );

              })}
            </div>
            {illustrationError && !illustrating && (
              <div
                data-testid="illustration-retry-notice"
                role="alert"
                className="flex flex-col sm:flex-row items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center"
              >
                <span className="text-[11px] text-amber-800 dark:text-amber-200">
                  {illustrationError}
                </span>
                <button
                  data-testid="illustration-retry-button"
                  onClick={handleRetryIllustrations}
                  className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shadow inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("sel.retry_illustrations", "Try pictures again")}
                </button>
              </div>
            )}

            {/* Retry-failed pill removed — failed pages fall back to the
                neutral placeholder with an inline Illustrate button, so users
                never see the loud red "Retry N failed" chip. */}


            {pendingCount > 0 && (
              <span className="text-[11px] text-muted-foreground dark:text-white/60">
                {t("sel.illustrations_queue", `${pendingCount} in queue`)}
              </span>
            )}
            {/*
              Screen-reader-only live region: announces toast phases and
              per-batch status changes (queued → generating → ready/failed)
              for users who can't see the visual toasts or the progress dots.
              `polite` so it never interrupts in-progress speech.
            */}
            <div
              data-testid="illustration-live-region"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {liveAnnouncement}
            </div>

          </div>
        );
      })()}


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

        {/* ILLUSTRATE + PDF — Family / Premium tiers. User-triggered only (Function B). */}
        {canIllustrate && canExportPdf ? (
          (() => {
            const allReady = pages.length > 0 && pages.every((p) => !!p.imageUrl);
            return (
              <button
                data-testid="illustrate-download-button"
                data-all-ready={allReady ? "true" : "false"}
                onClick={async () => {
                  // Reuse existing pictures; only draw the missing pages, then
                  // WAIT for real completion before touching the PDF export.
                  if (!allReady) {
                    const missing = pages.filter((p) => !p.imageUrl);
                    const res = await runIllustrate(missing.length ? missing : pages);
                    const stillMissing = (missing.length ? missing : pages).filter(
                      (p) => !res.readyIndexes.includes(p.index),
                    );
                    if (!res.ok || stillMissing.length > 0) {
                      // Never continue to PDF with pending/failed illustrations.
                      toast.error(
                        t(
                          "sel.illustrations_required_for_pdf",
                          "The illustrated PDF was not created because some pictures are still missing. Please retry.",
                        ),
                      );
                      return;
                    }
                  }
                  if (!requireSubscription("pdf")) return;
                  await handleExportPdf();
                }}

                disabled={illustrating || exporting}
                title={allReady ? t("sel.illustrations_ready_title", "Illustrations already generated — will export PDF") : undefined}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-70"
              >
                {illustrating || exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {illustrating
                  ? t("sel.illustrating", "Illustrating…")
                  : exporting
                  ? t("sel.exporting", "Exporting…")
                  : allReady
                  ? t("sel.download_pdf", "Download PDF")
                  : t("sel.illustrate_download", "Illustrate & Download")}
              </button>
            );
          })()
        ) : (
          <PremiumBadge featureKey="illustrations" size="lg" />
        )}

        <button
          onClick={handleDownloadMp3}
          disabled={mp3Loading}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-70"
          title={t("sel.mp3_hint", "Free voice download — 10 to 30 seconds")}
        >
          {mp3Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {mp3Loading
            ? t("sel.mp3_building", "Generating audio…")
            : t("sel.download_mp3", "Download MP3")}
        </button>


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
