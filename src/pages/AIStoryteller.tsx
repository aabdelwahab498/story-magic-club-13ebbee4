import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Wand2, Volume2, Loader2, Pause, Play, Square, Home, BookOpen, Crown, Lock, RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeApiError, isSessionExpired, type NormalizedApiError } from "@/lib/apiErrorNormalization";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import type { BrowserTtsHandle } from "@/lib/browserTts";
import { pauseAudio, resumeAudio } from "@/lib/audioDebug";
import NarratorAvatar from "@/components/NarratorAvatar";
import ReadingMode from "@/components/ReadingMode";
import { generateClassicIllustrations, type ClassicIllustration } from "@/lib/aiStoryApi";
import { handleEdgeError, type EdgeErrorInfo } from "@/lib/edgeErrors";
import { useActiveChild, resolveActiveChild } from "@/lib/childProfilesApi";
import { getLocalized } from "@/lib/multilingual";
import { planSelStory, composeSelStory, ComposeStoryError, type ComposeStoryInput, type SelStoryResponse, type SelPlanResponse } from "@/lib/selStoryApi";

import SelStoryViewer from "@/components/SelStoryViewer";
import PremiumBadge from "@/components/PremiumBadge";
import { BrowserNarratorSettings } from "@/components/BrowserNarratorSettings";
import IllustrateButton from "@/components/IllustrateButton";
import { useSubscription } from "@/hooks/useSubscription";
import { useByokStatus } from "@/hooks/useByokStatus";
import UpgradeModal from "@/components/UpgradeModal";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

import {
  generateTrialStory,
  generateTrialPdf,
  downloadTrialPdf,
  prepareTrialPdfDownloadTarget,
  TrialRateLimitedError,
  TrialContentRejectedError,
  TrialServerError,
  loadTrialResume,
  clearTrialResume,
  type TrialStoryResponse,
} from "@/lib/trialStoryApi";
import { waitForCanonicalStoryPdf } from "@/api/storyExports.api";
import { generateStoryMp3, downloadStoryMp3, StoryMp3Error } from "@/lib/storyTtsApi";
import StoryExportBar from "@/components/story/StoryExportBar";
import StoryPlanPreview from "@/components/StoryPlanPreview";



const CHARACTER_KEYS = ["wizard", "fairy", "robot", "dragon", "alien"] as const;
const THEME_KEYS = ["adventure", "animals", "space", "fantasy", "underwater"] as const;
const AGE_KEYS = ["3-5", "6-8", "9-12"] as const;
const LENGTH_KEYS = ["short", "medium", "long"] as const;

const CHAR_COLORS: Record<string, string> = {
  wizard: "#8B5CF6",
  fairy: "#FF9AD5",
  robot: "#78CEFF",
  dragon: "#FFB347",
  alien: "#7BEDAD",
};

// Per-theme visual identity: emoji, gradient (HSL — design tokens), and hint accent
const THEME_STYLES: Record<
  string,
  { emoji: string; gradient: string; ring: string; chip: string }
> = {
  adventure: {
    emoji: "🗺️",
    gradient: "from-orange-300/70 via-amber-200/60 to-yellow-200/60",
    ring: "ring-orange-400",
    chip: "bg-orange-500/20 text-orange-900 dark:text-orange-100",
  },
  animals: {
    emoji: "🦊",
    gradient: "from-green-300/70 via-lime-200/60 to-emerald-200/60",
    ring: "ring-green-500",
    chip: "bg-green-500/20 text-green-900 dark:text-green-100",
  },
  space: {
    emoji: "🚀",
    gradient: "from-indigo-400/70 via-purple-300/60 to-blue-300/60",
    ring: "ring-indigo-500",
    chip: "bg-indigo-500/20 text-indigo-50 dark:text-indigo-100",
  },
  fantasy: {
    emoji: "🧚",
    gradient: "from-pink-300/70 via-fuchsia-200/60 to-purple-200/60",
    ring: "ring-pink-500",
    chip: "bg-pink-500/20 text-pink-900 dark:text-pink-100",
  },
  underwater: {
    emoji: "🐠",
    gradient: "from-cyan-300/70 via-teal-200/60 to-sky-200/60",
    ring: "ring-cyan-500",
    chip: "bg-cyan-500/20 text-cyan-900 dark:text-cyan-100",
  },
};

// Age-band styling — younger = bigger, more rounded, more playful
const AGE_STYLES: Record<string, { textScale: string; emoji: string }> = {
  "3-5": { textScale: "text-base sm:text-lg", emoji: "🧸" },
  "6-8": { textScale: "text-sm sm:text-base", emoji: "🎒" },
  "9-12": { textScale: "text-sm", emoji: "📚" },
};

const AIStoryteller = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isAr = lang?.startsWith("ar");
  const { active: activeChild } = useActiveChild();
  const { user, isAdmin } = useAuth();
  const sub = useSubscription();
  const byok = useByokStatus();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  
  const [characterId, setCharacterId] = useState<(typeof CHARACTER_KEYS)[number]>("wizard");
  const [themeId, setThemeId] = useState<(typeof THEME_KEYS)[number]>("adventure");
  const [ageId, setAgeId] = useState<(typeof AGE_KEYS)[number]>("3-5");
  const [lengthId, setLengthId] = useState<(typeof LENGTH_KEYS)[number]>("short");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [story, setStory] = useState("");
  const [selMode, setSelMode] = useState(true);
  const [selStory, setSelStory] = useState<SelStoryResponse | null>(null);
  // Debug: log every time selStory changes so we can verify the download banner should render
  useEffect(() => {
    if (selStory) {
      console.log("[SEL] selStory state updated → download buttons should be VISIBLE", {
        title: selStory.title,
        pages: selStory.pages?.length,
      });
    } else {
      console.log("[SEL] selStory state cleared → download buttons hidden");
    }
  }, [selStory]);
  const [illustrations, setIllustrations] = useState<ClassicIllustration[]>([]);
  const [illustrating, setIllustrating] = useState(false);
  const [illustrationsGated, setIllustrationsGated] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<EdgeErrorInfo | null>(null);
  /** Normalized (category + retryability) view of the last generation failure. */
  const [normalizedError, setNormalizedError] = useState<NormalizedApiError | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  /**
   * In-flight guard at the action boundary: the same user interaction can never
   * produce two concurrent canonical requests, no matter how the click/Enter
   * events arrive or how fast the button re-renders.
   */
  const inFlightRef = useRef(false);
  /** True once a request has been running long enough to reassure the user. */
  const [longRunning, setLongRunning] = useState(false);
  const longRunningTimerRef = useRef<number | null>(null);
  type GenStep = "idle" | "planning" | "writing" | "evaluating" | "saving" | "done";
  const [genStep, setGenStep] = useState<GenStep>("idle");
  const stepTimersRef = useRef<number[]>([]);
  const lastModeRef = useRef<"sel" | "classic" | null>(null);
  const [planPreview, setPlanPreview] = useState<SelPlanResponse["blueprint"] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [lastSelInput, setLastSelInput] = useState<ComposeStoryInput | null>(null);
  type SelInput = ComposeStoryInput;

  const queryClient = useQueryClient();




  // ---- Guest trial state: keep the raw payload so we can render images + PDF ----
  const [guestTrial, setGuestTrial] = useState<TrialStoryResponse | null>(null);
  const [guestIllustrating, _setGuestIllustrating] = useState(false);
  const [guestPdfLoading, setGuestPdfLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mp3Loading, setMp3Loading] = useState(false);

  const handleDownloadMp3 = async () => {
    if (!story) return;
    setMp3Loading(true);
    try {
      const isArabic = /[\u0600-\u06FF]/.test(story);
      const res = await generateStoryMp3(
        {
          text: story,
          language: isArabic ? "ar" : "en",
        },
        {
          onProgress: (evt) => {
            if (evt.phase === "generating") toast.info(evt.message, { id: "mp3-progress" });
            if (evt.phase === "retrying") toast.warning(evt.message, { id: "mp3-progress" });
            if (evt.phase === "cached") toast.success(evt.message, { id: "mp3-progress" });
          },
        },
      );
      const rawTitle = `${t(`ai.themes.${themeId}`)}-${t(`ai.characters.${characterId}`)}`;
      const safe = rawTitle.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "story";
      await downloadStoryMp3(res.url, `${safe}.mp3`);
      toast.success(t("page_ai_storyteller.mp3_ready", "Audio MP3 downloaded 🎧"));
    } catch (e) {
      const msg = e instanceof StoryMp3Error ? e.message : "Could not build the audio.";
      toast.error(msg);
    } finally {
      setMp3Loading(false);
    }
  };


  // Drive the visual progress bar with timed step transitions while the
  // edge function runs server-side (it is not streamable). Cleared on result.
  const startProgressTimeline = () => {
    stepTimersRef.current.forEach((id) => window.clearTimeout(id));
    stepTimersRef.current = [];
    setGenStep("planning");
    stepTimersRef.current.push(window.setTimeout(() => setGenStep("writing"), 3000));
    stepTimersRef.current.push(window.setTimeout(() => setGenStep("evaluating"), 14000));
    stepTimersRef.current.push(window.setTimeout(() => setGenStep("saving"), 28000));
  };
  const stopProgressTimeline = (finalStep: GenStep = "idle") => {
    stepTimersRef.current.forEach((id) => window.clearTimeout(id));
    stepTimersRef.current = [];
    setGenStep(finalStep);
  };

  /**
   * Backend-side retries can legitimately make a request take longer, so the
   * frontend never aborts on a short timer — it only softens the waiting copy
   * after a while. No fake percentages, no provider/retry internals.
   */
  const startLongRunningWatch = () => {
    if (longRunningTimerRef.current !== null) window.clearTimeout(longRunningTimerRef.current);
    setLongRunning(false);
    longRunningTimerRef.current = window.setTimeout(() => setLongRunning(true), 12000);
  };
  const stopLongRunningWatch = () => {
    if (longRunningTimerRef.current !== null) {
      window.clearTimeout(longRunningTimerRef.current);
      longRunningTimerRef.current = null;
    }
    setLongRunning(false);
  };
  useEffect(() => () => stopLongRunningWatch(), []);

  // Gating: signed-in users have a real limit; guests are allowed a couple of trial stories per session.
  const guestMode = !user;

  // Generation is synchronous against the edge functions — no polling needed.


  const limitStories = sub.plan?.monthly_story_limit ?? null;
  const storiesCreated = sub.storiesUsedThisMonth || 0;
  const creditsExhausted = !guestMode && !sub.loading && limitStories !== null && limitStories !== undefined && storiesCreated >= limitStories;
  // Canonical admin/super_admin never hit the client-side monthly quota gate.
  const limitReached = creditsExhausted && !byok.bypass && !isAdmin;

  const buildSelInput = async (): Promise<SelInput> => {
    const ageNum = ageId === "3-5" ? 4 : ageId === "6-8" ? 7 : 10;
    // ONE authoritative resolved child for the whole authenticated journey.
    // `resolveActiveChild()` validates the stored `najmah.active_child_id`
    // against the RLS-visible child_profiles rows, deterministically falls back
    // to the first owned child, and persists that selection. We always trust it
    // over the (possibly still-loading) cached query result, so plan and create
    // receive the exact same canonical child UUID.
    const child = (await resolveActiveChild()) ?? activeChild ?? null;
    if (!child?.id) {
      throw new ComposeStoryError(
        "child_required",
        t(
          "family.select_child_first",
          "Please select a child profile before generating a story.",
        ),
      );
    }
    const focus = child.emotionalGoals && Array.isArray(child.emotionalGoals)
      ? (child.emotionalGoals as string[])
      : [];
    // Auto-detect language from the custom prompt: if the user writes in
    // Arabic (or another supported script) we override the UI locale so the
    // story is produced in that language instead of the interface language.
    const trimmedPrompt = customPrompt.trim();
    const detectPromptLang = (text: string): string | null => {
      if (!text) return null;
      if (/[\u0600-\u06FF]/.test(text)) return "ar";
      // Latin-only heuristics for the other supported languages are unreliable
      // for short prompts, so we only auto-switch on non-Latin scripts.
      return null;
    };
    const effectiveLang = detectPromptLang(trimmedPrompt) ?? lang;
    return {
      childProfileId: child.id,
      childName: child.name || "the child",
      age: child.age ?? ageNum,
      theme: t(`ai.themes.${themeId}`),
      emotionalFocus: focus,
      language: effectiveLang,
      customPrompt: trimmedPrompt || undefined,
    };
  };



  /**
   * ONE error path for the whole authenticated generation journey.
   * Every failure is folded through `normalizeApiError` (see
   * src/lib/apiErrorNormalization.ts), so the user only ever sees friendly,
   * localized copy — never raw JSON, provider text or stack traces — and the
   * form/child/prompt/settings are always left intact for a manual retry.
   */
  const handleSelError = async (e: unknown) => {
    stopProgressTimeline("idle");
    // Raw error stays in the console only; the UI shows friendly text.
    console.error("[compose-story] failed", e);

    const normalized = normalizeApiError(e, t);
    setNormalizedError(normalized);
    setErrorDetails({
      status: normalized.status,
      code: normalized.code,
      message: normalized.message,
      requestId: normalized.correlationId,
      // Sanitized developer details only — no tokens, headers or prompts.
      raw: {
        code: normalized.code,
        category: normalized.category,
        retryable: normalized.retryable,
        // Backend envelope text (sanitized + truncated) so a 500 is diagnosable.
        serverMessage: normalized.serverMessage,
      },
    });
    setLastError(normalized.message);

    // Session genuinely expired → controlled sign-in-required state.
    // (No refresh loops: useAuth owns the single supported refresh behaviour.)
    if (isSessionExpired(e)) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      toast.error(normalized.message);
      navigate("/auth", { state: { from: "/ai-storyteller" } });
      return;
    }

    if (normalized.retryable) toast.warning(normalized.message);
    else toast.error(normalized.message);
  };



  // Guest path: route to the trial-story edge function (anonymous-friendly).
  // Renders the result in the classic story view (no audio, no illustrate button).
  const runGuestTrial = async () => {
    lastModeRef.current = "classic";
    setLastError(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
    setGenerating(true);
    setStory("");
    setSelStory(null);
    setIllustrations([]);
    setIllustrationsGated(false);
    setGuestTrial(null);
    startProgressTimeline();
    try {
      const ageNum = ageId === "3-5" ? 4 : ageId === "6-8" ? 7 : 10;
      const childName = activeChild?.name ?? (t("page_ai_storyteller.hero", "Hero"));
      const themeLabel = t(`ai.themes.${themeId}`);
      const trimmedPrompt = customPrompt.trim();
      // Auto-detect Arabic input so the story is written in the user's language,
      // not the current UI locale.
      const effectiveLang = /[\u0600-\u06FF]/.test(trimmedPrompt) ? "ar" : lang;

      // ── Step 1: Story text — pass the user's custom brief so the story
      // reflects their actual input instead of a generic demo.
      const res = await generateTrialStory({
        childName,
        age: ageNum,
        theme: themeLabel,
        language: effectiveLang,
        customPrompt: trimmedPrompt || undefined,
      });
      stopProgressTimeline("done");
      const text = res.pages.map((p) => p.text).join("\n\n");
      setStory(text);
      setGuestTrial(res);
      setIllustrationsGated(false);

      // ── Step 2: Images/Audio are now opt-in via subscription.
      // The trial returns text only; the user chooses (Images or Audio) after reading.

    } catch (e) {
      stopProgressTimeline("idle");
      if (e instanceof TrialRateLimitedError) {
        const mins = Math.max(1, Math.ceil(e.retryAfter / 60));
        const msg = isAr
          ? `التجربة موقوفة مؤقتاً للحماية ضد الإساءة. حاول بعد ~${mins} دقيقة، أو اشترك علشان توليد بلا حدود.`
          : `Trial paused briefly to prevent abuse. Try again in ~${mins} min, or subscribe for unlimited stories.`;
        toast.warning(msg);
        setLastError(msg);
      } else if (e instanceof TrialContentRejectedError) {
        toast.error(e.userMessage);
        setLastError(e.userMessage);
      } else if (e instanceof TrialServerError) {
        const msg = t("page_ai_storyteller.preparing_your_magical_story_please_try_", "Preparing your magical story… please try again in a moment.");
        toast.error(msg);
        setLastError(msg);
      } else {
        const msg = t("page_ai_storyteller.preparing_your_magical_story_please_try_", "Preparing your magical story… please try again in a moment.");
        toast.error(msg);
        setLastError(msg);
        const info = await handleEdgeError(e, t, { context: "trial-story" });
        setErrorDetails(info);
        console.error("[trial-story] failed", info, e);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 3: PDF (on demand). Uses whatever images we have at the moment.
  const handleGuestDownloadPdf = async () => {
    if (!guestTrial) return;
    const downloadTarget = prepareTrialPdfDownloadTarget();
    setGuestPdfLoading(true);
    try {
      const pdf = await generateTrialPdf({
        title: guestTrial.title,
        pages: guestTrial.pages.map((p) => ({
          index: p.index,
          text: p.text,
          emotionTag: p.emotionTag,
          imageUrl: p.imageUrl ?? null,
        })),
        childName: activeChild?.name,
        selStatement: guestTrial.sel_outcome?.statement,
      });
      const rawTitle = (guestTrial.title || "").trim();
      const cleaned = rawTitle.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
      const safeTitle = cleaned || "my-story";
      downloadTrialPdf(pdf.pdfBase64, `${safeTitle}.pdf`, downloadTarget);
      toast.success(t("page_ai_storyteller.your_pdf_is_ready", "Your PDF is ready ✨"));
    } catch (e) {
      try { downloadTarget?.close(); } catch { /* ignore */ }
      console.error("[trial-pdf] failed", e);
      toast.error(
        t("page_ai_storyteller.could_not_build_the_pdf_please_try_again", "Could not build the PDF — please try again in a moment."),
      );
    } finally {
      setGuestPdfLoading(false);
    }
  };

  // Authenticated users — build a PDF from the current AI story + any illustrations.
  const handleDownloadPdf = async () => {
    if (!story) return;
    const downloadTarget = prepareTrialPdfDownloadTarget();
    setPdfLoading(true);
    try {
      const scenes = splitIntoScenes(story, 6);
      const title = `${t(`ai.themes.${themeId}`)} • ${t(`ai.characters.${characterId}`)}`;
      const pdf = await generateTrialPdf({
        title,
        pages: scenes.map((text, i) => ({
          index: i,
          text,
          imageUrl: illustrations[i]?.imageUrl ?? null,
        })),
        childName: activeChild?.name,
      });
      const cleaned = title.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
      downloadTrialPdf(pdf.pdfBase64, `${cleaned || "story"}.pdf`, downloadTarget);
      toast.success(t("page_ai_storyteller.your_pdf_is_ready", "Your PDF is ready ✨"));
    } catch (e) {
      try { downloadTarget?.close(); } catch { /* ignore */ }
      console.error("[pdf] failed", e);
      toast.error(
        t("page_ai_storyteller.could_not_build_the_pdf_please_try_again", "Could not build the PDF — please try again in a moment."),
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // Phase 1: plan only. Shows the blueprint in a modal so the user can approve before
  // the full 10–15 page write. When customPrompt is empty we skip preview and go straight to full.
  const handleGenerateSel = async () => {
    if (guestMode) return runGuestTrial();

    if (limitReached) {
      setUpgradeOpen(true);
      return;
    }
    // Double-submit protection at the action boundary (not just the disabled
    // attribute): a second click/Enter while a canonical request is in flight is
    // dropped, so the same interaction never creates two stories.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    lastModeRef.current = "sel";
    setLastError(null);
    setErrorDetails(null);
    setNormalizedError(null);
    setShowErrorDetails(false);
    let input: SelInput;
    try {
      input = await buildSelInput();
    } catch (e) {
      inFlightRef.current = false;
      await handleSelError(e);
      return;
    }
    setLastSelInput(input);

    // No custom brief → skip preview, go full directly
    if (!input.customPrompt) {
      inFlightRef.current = false;
      return runFullCompose(input);
    }

    setPlanning(true);
    startLongRunningWatch();
    try {
      const plan = await planSelStory(input);
      setPlanPreview(plan.blueprint);
    } catch (e) {
      await handleSelError(e);
    } finally {
      inFlightRef.current = false;
      stopLongRunningWatch();
      setPlanning(false);
    }
  };

  // Phase 2: full write (optionally with approved blueprint).
  const runFullCompose = async (
    input: SelInput,
    presetBlueprint?: Record<string, unknown>,
  ) => {
    // Same in-flight guard for the story-creation request.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPlanPreview(null);
    setGenerating(true);
    setSelStory(null);
    setLastError(null);
    setErrorDetails(null);
    setNormalizedError(null);
    setShowErrorDetails(false);
    startProgressTimeline();
    startLongRunningWatch();


    try {
      console.log("[SEL] composeSelStory → start", input);
      const res = await composeSelStory({
        ...input,
        ...(presetBlueprint ? { presetBlueprint } : {}),
      } as SelInput);
      stopProgressTimeline("done");
      setSelStory(res);
      const text = (res.pages ?? []).map((p) => p.text).join("\n\n");
      if (text) setStory(text);
      try {
        localStorage.setItem(
          "last-generated-sel-story",
          JSON.stringify({ story: res, ts: Date.now() }),
        );
      } catch (err) {
        console.warn("Failed to save to local storage", err);
      }
      // Keep "My Stories" and its pages in sync with the freshly persisted row.
      queryClient.invalidateQueries({ queryKey: ["my_ai_stories"] });
      queryClient.invalidateQueries({ queryKey: ["my_ai_stories_page"] });
      queryClient.invalidateQueries({ queryKey: ["ai-story-history"] });
    } catch (e) {
      console.error("[SEL] composeSelStory → error", e);
      stopProgressTimeline("idle");
      await handleSelError(e);
    } finally {
      inFlightRef.current = false;
      stopLongRunningWatch();
      setGenerating(false);
    }
  };


  const handleApprovePlan = () => {
    if (!planPreview || !lastSelInput) return;
    runFullCompose(lastSelInput, planPreview as Record<string, unknown>);
  };

  const handleRegenerate = () => {
    if (!lastSelInput) return;
    setSelStory(null);
    // Re-run from scratch (new blueprint) using the same form inputs
    handleGenerateSel();
  };


  // Prefill age + custom focus from active child profile (Phase 2).
  useEffect(() => {
    if (!activeChild) return;
    const a = activeChild.age ?? 0;
    if (a >= 9) setAgeId("9-12");
    else if (a >= 6) setAgeId("6-8");
    else if (a >= 3) setAgeId("3-5");
    if (Array.isArray(activeChild.emotionalGoals) && activeChild.emotionalGoals.length) {
      setCustomPrompt(
        `Focus emotion: ${activeChild.emotionalGoals.join(", ")}. Hero name: ${activeChild.name}.`,
      );
    } else if (activeChild.name) {
      setCustomPrompt(`Hero name: ${activeChild.name}.`);
    }
  }, [activeChild?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accept an incoming idea from /stories ("Tell us your idea") and auto-generate.
  const location = useLocation();
  const navigate = useNavigate();
  const autoFiredRef = useRef(false);
  useEffect(() => {
    const state = (location.state as { idea?: string; autoGenerate?: boolean; narrator?: typeof CHARACTER_KEYS[number] } | null) ?? null;
    if (!state?.idea) return;
    setCustomPrompt(state.idea);
    if (state.narrator && (CHARACTER_KEYS as readonly string[]).includes(state.narrator)) {
      setCharacterId(state.narrator);
    } else {
      setCharacterId("wizard");
    }
    setSelMode(true);
    if (state.autoGenerate && !autoFiredRef.current) {
      autoFiredRef.current = true;
      // Defer one tick so state updates flush, then generate.
      setTimeout(() => { handleGenerateSel(); }, 50);
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume a pending story idea saved from /stories before the user subscribed.
  // Only fires once the user is signed in AND has an active audio-capable plan.
  const pendingFiredRef = useRef(false);
  useEffect(() => {
    if (pendingFiredRef.current) return;
    if (!user || sub.loading) return;
    if (!sub.canAudio || sub.tier === "free") return;
    let pending: { idea?: string; narrator?: string; ts?: number } | null = null;
    try {
      const raw = localStorage.getItem("pending-story-idea");
      if (raw) pending = JSON.parse(raw);
    } catch { /* ignore */ }
    if (!pending?.idea) return;
    pendingFiredRef.current = true;
    try { localStorage.removeItem("pending-story-idea"); } catch { /* ignore */ }
    setCustomPrompt(pending.idea);
    if (pending.narrator && (CHARACTER_KEYS as readonly string[]).includes(pending.narrator)) {
      setCharacterId(pending.narrator as typeof CHARACTER_KEYS[number]);
    }
    setSelMode(true);
    if (!autoFiredRef.current) {
      autoFiredRef.current = true;
      setTimeout(() => { handleGenerateSel(); }, 80);
    }
  }, [user, sub.loading, sub.canAudio, sub.tier]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume free-trial inputs after sign-up: prefill the form so the user can
  // continue the same story idea now that they have a real account.
  const resumeFiredRef = useRef(false);
  useEffect(() => {
    if (!user || resumeFiredRef.current) return;
    const resume = loadTrialResume();
    if (!resume) return;
    resumeFiredRef.current = true;
    if (resume.age <= 5) setAgeId("3-5");
    else if (resume.age <= 8) setAgeId("6-8");
    else setAgeId("9-12");
    setCustomPrompt(
      `Hero name: ${resume.childName}. Story idea: ${resume.theme}.`,
    );
    setSelMode(true);
    clearTrialResume();
    toast.success(
      t("page_ai_storyteller.welcome_let_s_continue_your_story_with_i", "Welcome! Let's continue your story with images & audio ✨"),
    );
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps



  // narration: 'idle' | 'loading' | 'playing' | 'paused'
  const [narrationState, setNarrationState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const browserTtsRef = useRef<BrowserTtsHandle | null>(null);
  const hdAudioRef = useRef<HTMLAudioElement | null>(null);
  // Remember the last playback position so we resume exactly where the user paused.
  const hdAudioPositionRef = useRef<number>(0);
  // Which voice engine is currently driving the narration (null = idle)
  const [activeVoiceSource, setActiveVoiceSource] = useState<"hd" | "browser" | null>(null);

  // HD voice (ElevenLabs) preference — persisted across sessions
  const [useHdVoice, _setUseHdVoice] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("starry-tales-hd-voice");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("starry-tales-hd-voice", useHdVoice ? "1" : "0");
    }
  }, [useHdVoice]);

  // Hover preview narration (separate from full-story narration)
  const previewTtsRef = useRef<BrowserTtsHandle | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const [previewCharacterId, setPreviewCharacterId] = useState<string | null>(null);

  const stopPreview = () => {
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewTtsRef.current) {
      previewTtsRef.current.cancel();
      previewTtsRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewCharacterId(null);
  };

  const startPreview = (id: string) => {
    // Don't preview while a full story is being narrated
    if (narrationState === "playing" || narrationState === "loading") return;
    // Cancel any pending preview before starting a new one
    stopPreview();
    // Small debounce so quick mouse passes don't trigger speech
    previewTimeoutRef.current = window.setTimeout(async () => {
      try {
        const { isBrowserTtsSupported, speakWithBrowser } = await import("@/lib/browserTts");
        if (!isBrowserTtsSupported()) return;
        const greeting = t(`ai.greetings.${id}`, t(`ai.characters.${id}`));
        const handle = await speakWithBrowser({
          text: greeting,
          language: lang,
          character: id,
          ageId,
          onEnd: () => {
            previewTtsRef.current = null;
            setPreviewCharacterId((cur) => (cur === id ? null : cur));
          },
          onError: () => {
            previewTtsRef.current = null;
            setPreviewCharacterId((cur) => (cur === id ? null : cur));
          },
        });
        previewTtsRef.current = handle;
        setPreviewCharacterId(id);
      } catch {
        // silently ignore — preview is non-essential
      }
    }, 220);
  };

  // Cleanup any preview audio on unmount
  useEffect(() => {
    return () => stopPreview();
  }, []);

  // Split a generated story into scene-like chunks for image generation.
  const splitIntoScenes = (text: string, max = 6): string[] => {
    if (!text) return [];
    const paragraphs = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const base = paragraphs.length ? paragraphs : [text];
    if (base.length <= max) return base;
    // Merge to fit `max` evenly
    const out: string[] = [];
    const chunkSize = Math.ceil(base.length / max);
    for (let i = 0; i < base.length; i += chunkSize) {
      out.push(base.slice(i, i + chunkSize).join(" "));
    }
    return out.slice(0, max);
  };

  const generateSceneIllustrations = async (storyText: string) => {
    const scenes = splitIntoScenes(storyText, 6);
    if (scenes.length === 0) return;
    // Truncate each scene to keep prompts compact.
    const trimmed = scenes.map((s) => s.slice(0, 280));
    setIllustrating(true);
    console.info("[AIStoryteller] illustrate requested by user", { scenes: trimmed.length });
    try {
      const res = await generateClassicIllustrations({
        scenes: trimmed,
        character: t(`ai.characters.${characterId}`),
      }, { trigger: "user", source: "AIStoryteller.generateSceneIllustrations" });

      setIllustrations(res.illustrations);
      setIllustrationsGated(res.gated && res.tier !== "paid");
    } catch (e) {
      console.error("illustrations failed", e);
      toast.error(t("page_ai_storyteller.couldn_t_draw_the_pictures_this_time", "Couldn't draw the pictures this time"));
    } finally {
      setIllustrating(false);
    }
  };

  /**
   * Canonical cutover: authenticated story creation always goes through
   * Backend Core (`POST /api/v2/stories/plan` → `POST /api/v2/stories` → polling)
   * via handleGenerateSel. The legacy `generate-story` edge function is no longer
   * called for authenticated generation. Guests keep the separate trial path.
   */
  const handleGenerate = async () => {
    if (guestMode) return runGuestTrial();
    return handleGenerateSel();
  };


  const stopAllNarration = () => {
    if (browserTtsRef.current) {
      browserTtsRef.current.cancel();
      browserTtsRef.current = null;
    }
    if (hdAudioRef.current) {
      hdAudioRef.current.pause();
      hdAudioRef.current.src = "";
      hdAudioRef.current = null;
    }
    hdAudioPositionRef.current = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setNarrationState("idle");
    setActiveVoiceSource(null);
  };

  const startBrowserTts = async () => {
    const { isBrowserTtsSupported, speakWithBrowser } = await import("@/lib/browserTts");
    if (!isBrowserTtsSupported()) {
      setNarrationState("idle");
      return;
    }
    const handle = await speakWithBrowser({
      text: story,
      language: lang,
      character: characterId,
      ageId,
      onEnd: () => {
        browserTtsRef.current = null;
        setNarrationState("idle");
        setActiveVoiceSource(null);
      },
      onError: (err) => {
        console.error("browser tts error:", err);
        browserTtsRef.current = null;
        setNarrationState("idle");
        setActiveVoiceSource(null);
      },
    });
    browserTtsRef.current = handle;
    setNarrationState("playing");
    setActiveVoiceSource("browser");
  };

  // Play / Pause toggle — starts narration on first click, pauses/resumes thereafter
  const handlePlayPause = async () => {
    if (!story) return;

    if (narrationState === "playing") {
      if (hdAudioRef.current) {
        pauseAudio(hdAudioRef.current, hdAudioPositionRef, "Narrator/HD");
      }
      browserTtsRef.current?.pause();
      setNarrationState("paused");
      return;
    }
    if (narrationState === "paused") {
      if (hdAudioRef.current) {
        resumeAudio(hdAudioRef.current, hdAudioPositionRef, "Narrator/HD");
      }
      browserTtsRef.current?.resume();
      setNarrationState("playing");
      return;
    }

    setNarrationState("loading");

    // Browser Web Speech API only — no cloud TTS, no API keys, no payments.
    try {
      await startBrowserTts();
    } catch (err) {
      console.error("browser tts failed to start:", err);
      const { isBrowserTtsSupported } = await import("@/lib/browserTts");
      if (!isBrowserTtsSupported()) {
        toast.error(
          t(
            "narrator.unsupported",
            "Your browser doesn't support built-in narration. Please try the latest Chrome, Edge, Safari, or Firefox.",
          ),
        );
      } else {
        toast.error(t("page_ai_storyteller.audio_playback_failed", "Audio playback failed"));
      }
      setNarrationState("idle");
    }
  };

  const charName = t(`ai.characters.${characterId}`);

  return (
    <div className="animate-fade-in" key={lang}>
      {/* Planning overlay (while plan call is in-flight) */}
      {planning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="font-bold text-foreground">
              {longRunning
                ? t("page_ai_storyteller.still_working_magic", "Najmah is still working its magic…")
                : t("page_ai_storyteller.planning_your_story", "Planning your story…")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {longRunning
                ? t("page_ai_storyteller.thanks_for_waiting", "Thanks for waiting — your story settings are safe.")
                : t("page_ai_storyteller.a_few_seconds_before_the_preview", "A few seconds before the preview")}
            </p>
          </div>
        </div>
      )}

      {/* Blueprint preview modal — user approves before the full 10–15 page write.
          Wrapped so a malformed optional plan field can never take down the page. */}
      {planPreview && !generating && (
        <SectionErrorBoundary
          sectionLabel={t("page_ai_storyteller.plan_preview_unavailable", "We couldn't show the story plan")}
          hint={t(
            "page_ai_storyteller.plan_preview_unavailable_hint",
            "Your story settings are safe. You can write the story anyway or start again.",
          )}
          retryLabel={t("page_ai_storyteller.write_the_story", "Write the story")}
          onRetry={handleApprovePlan}
        >
          <StoryPlanPreview
            plan={planPreview}
            onEdit={() => setPlanPreview(null)}
            onApprove={handleApprovePlan}
          />
        </SectionErrorBoundary>
      )}


      {/* Top navigation: Home + Explore Stories */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4 sm:mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-sm border border-foreground/10 dark:border-white/25 text-foreground dark:text-white font-bold text-sm shadow-sm hover:scale-105 hover:bg-white dark:hover:bg-white/25 transition-all"
        >
          <Home className="h-4 w-4" />
          {t("ai.back_to_home", "Back to Home")}
        </Link>
        <Link
          to="/stories"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:scale-105 transition-all"
        >
          <BookOpen className="h-4 w-4" />
          {t("ai.explore_stories", "Explore Stories")}
        </Link>
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-6 sm:mb-8 flex items-center justify-center gap-2 text-foreground dark:text-white drop-shadow-md px-2">
        <span className="inline-flex items-center gap-2 bg-white dark:bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-foreground/10 dark:border-white/20 shadow-sm">
          <Sparkles className="text-yellow-500 dark:text-yellow-300 animate-twinkle drop-shadow-[0_0_8px_rgba(255,215,0,0.8)] h-6 w-6 sm:h-7 sm:w-7" />
          {t("ai.title")}
        </span>
      </h2>

      {/* Subscription / usage banner (signed-in users only) */}
      {user && !sub.loading && (
        <div className={`max-w-3xl mx-auto mb-4 px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm ${
          limitReached
            ? "bg-red-500/15 border-red-400/40 text-foreground dark:text-white"
            : "bg-white/70 dark:bg-white/10 border-foreground/10 dark:border-white/20 text-foreground dark:text-white"
        }`}>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="capitalize">{getLocalized(sub.plan?.name, lang) || sub.tier}</span>
            <span className="opacity-70">·</span>
            {/* Story-generation quota for the current plan — a different concept
                from the illustration credits shown in the header. Values and
                billing rules are unchanged; only the label is explicit. */}
            <span>
              {t("page_ai_storyteller.stories_remaining", "Stories remaining")}: {limitStories === null ? '∞' : Math.max(0, (limitStories || 0) - storiesCreated)}
            </span>
            {byok.bypass && creditsExhausted && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                🔑 {t("page_ai_storyteller.byok_unlimited", "Unlimited via personal key")}
              </span>
            )}
          </div>
          {(sub.tier === "free" || limitReached) && (
            <Link
              to="/pricing"
              className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition"
            >
              {t("page_ai_storyteller.upgrade_plan", "Upgrade plan")}
            </Link>
          )}
        </div>
      )}

      {selStory ? (
        <div>
          {(() => {
            console.log("[SEL] rendering download banner", {
              hasSelStory: !!selStory,
              generating,
              canExportPdf: sub.canExportPdf,
              isAdmin,
            });
            return null;
          })()}
          {customPrompt.trim() && (
            <div className="mb-3 mx-auto max-w-3xl flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-[11px] uppercase tracking-wide font-bold text-primary shrink-0">
                {t("page_ai_storyteller.your_story_is_about", "Your story is about")}
              </span>
              <span className="text-xs sm:text-sm text-foreground/90 dark:text-white/90 line-clamp-2 flex-1 min-w-0">
                "{customPrompt.trim()}"
              </span>
              <button
                type="button"
                onClick={handleRegenerate}
                className="ml-auto rtl:mr-auto rtl:ml-0 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
              >
                <Loader2 className="h-3.5 w-3.5" />
                {t("page_ai_storyteller.regenerate", "Regenerate")}
              </button>
            </div>
          )}
          <div className="mb-5 mx-auto max-w-3xl rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-indigo-950/40 shadow-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {t("page_ai_storyteller.story_ready_download_now", "Your story is ready — download it now")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const header = `${selStory.title}\n\n`;
                  const body = (selStory.pages ?? [])
                    .map((p) => `— Page ${p.index} —\n${p.text}`)
                    .join("\n\n");
                  const footer = selStory.sel_outcome?.statement
                    ? `\n\n---\n${selStory.sel_outcome.statement}\n`
                    : "";
                  const text = header + body + footer;
                  const safe = (selStory.title || "story")
                    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
                    .replace(/\s+/g, "-")
                    .slice(0, 60) || "story";
                  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${safe}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(t("page_ai_storyteller.txt_downloaded", "Story .txt downloaded"));
                }}
                className="px-6 py-3 text-base bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full font-extrabold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
              >
                <BookOpen className="h-5 w-5" />
                {t("page_ai_storyteller.download_story_txt", "Download story (.txt)")}
              </button>

              {(sub.canExportPdf || isAdmin) ? (
                <button
                  onClick={async () => {
                    const downloadTarget = prepareTrialPdfDownloadTarget();
                    setPdfLoading(true);
                    try {
                      const safe = (selStory.title || "story")
                        .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
                        .replace(/\s+/g, "-")
                        .slice(0, 60) || "story";
                      // Canonical saved story → Backend Core illustrated PDF export
                      // (waits for the story-media worker). No browser-built PDF here.
                      if (selStory.story_id) {
                        const result = await waitForCanonicalStoryPdf(selStory.story_id);
                        const url = result.download_url;
                        if (!url) throw new Error("no_pdf_url");
                        if (downloadTarget) downloadTarget.location.href = url;
                        else window.open(url, "_blank", "noopener");
                      } else {
                        const pdf = await generateTrialPdf({
                          title: selStory.title,
                          pages: (selStory.pages ?? []).map((p) => ({
                            index: p.index,
                            text: p.text,
                            emotionTag: p.emotionTag,
                            imageUrl: p.imageUrl ?? null,
                          })),
                          childName: activeChild?.name,
                          selStatement: selStory.sel_outcome?.statement,
                        });
                        downloadTrialPdf(pdf.pdfBase64, `${safe}.pdf`, downloadTarget);
                      }
                      toast.success(t("page_ai_storyteller.your_pdf_is_ready", "Your PDF is ready ✨"));
                    } catch (e) {
                      try { downloadTarget?.close(); } catch { /* ignore */ }
                      console.error("[sel-pdf] failed", e);
                      toast.error(t("page_ai_storyteller.could_not_build_the_pdf_please_try_again", "Could not build the PDF — please try again in a moment."));
                    } finally {
                      setPdfLoading(false);
                    }
                  }}
                  disabled={pdfLoading}
                  className="px-6 py-3 text-base bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-extrabold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {pdfLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
                  {pdfLoading
                    ? t("page_ai_storyteller.building_pdf", "Building PDF...")
                    : t("page_ai_storyteller.download_story_pdf", "Download story PDF")}
                  {isAdmin && !sub.canExportPdf ? " (owner)" : ""}
                </button>
              ) : (
                <Link
                  to="/pricing"
                  className="px-6 py-3 text-base bg-gradient-to-r from-amber-400 to-pink-500 text-white rounded-full font-extrabold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
                >
                  <Crown className="h-5 w-5" />
                  {t("page_ai_storyteller.subscribe_to_export_pdf", "Subscribe to export PDF")}
                </Link>
              )}
            </div>
          </div>
          {/* Story reader: a malformed optional page field degrades only this
              section — the generated story, media and downloads stay available. */}
          <SectionErrorBoundary
            sectionLabel={t("page_ai_storyteller.story_view_unavailable", "We couldn't display this story view")}
            hint={t(
              "page_ai_storyteller.story_view_unavailable_hint",
              "Your story is saved — you can still download it below.",
            )}
          >
            <SelStoryViewer story={selStory} onBack={() => setSelStory(null)} />
          </SectionErrorBoundary>

          {/* Audio / illustrations / PDF / downloads: one failing capability
              never invalidates the generated story. */}
          <SectionErrorBoundary
            sectionLabel={t("page_ai_storyteller.downloads_unavailable", "Downloads are unavailable right now")}
            hint={t(
              "page_ai_storyteller.downloads_unavailable_hint",
              "Your story and pictures are safe. Please try the downloads again in a moment.",
            )}
          >
            <StoryExportBar
              title={selStory.title}
              fullText={(selStory.pages ?? []).map((p) => p.text).join("\n\n")}
              language={((selStory as unknown as { language?: string }).language) || i18n.language || "en"}
              storyId={selStory.story_id ?? null}
              childId={activeChild?.id ?? null}
              childName={activeChild?.name ?? null}
              emotionTags={
                ((selStory.pages ?? []).map((p) => p.emotionTag).filter(Boolean) as string[])
              }
              pageCount={(selStory.pages ?? []).length}
              pages={(selStory.pages ?? []).map((p, i) => ({
                pageNumber: (p.index ?? i) + 1,
                text: p.text,
                illustrationUrl: p.imageUrl ?? null,
                emotionTag: p.emotionTag ?? null,
              }))}
            />
          </SectionErrorBoundary>

        </div>
      ) : !story ? (
        <div
          className={`bg-gradient-to-br ${THEME_STYLES[themeId].gradient} dark:bg-white/10 dark:bg-none backdrop-blur-md border border-foreground/10 dark:border-white/20 rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8 transition-all duration-500`}
        >
          {/* Theme + age banner — adapts visually to current selection */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-3 rounded-xl bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-foreground/10 dark:border-white/20">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl" aria-hidden="true">
                {THEME_STYLES[themeId].emoji}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-white/70">
                  {t("ai.story_theme")}
                </p>
                <p className="text-base sm:text-lg font-extrabold text-foreground dark:text-white">
                  {t(`ai.themes.${themeId}`)}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold ${THEME_STYLES[themeId].chip}`}
            >
              <span aria-hidden="true">{AGE_STYLES[ageId].emoji}</span>
              {t(`ai.ages.${ageId}`)}
            </span>
          </div>

          <h3 className={`font-extrabold mb-4 sm:mb-6 text-foreground dark:text-white ${AGE_STYLES[ageId].textScale}`}>
            {t("ai.design_storyteller")}
          </h3>

          <div className="mb-8">
            <h4 className="font-bold mb-3 text-foreground dark:text-white">
              {t("ai.choose_storyteller")}:
            </h4>

            {/* Large preview card for the currently selected narrator */}
            <div className="mb-4 flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-5 rounded-2xl bg-kids-softYellow/70 dark:bg-white/10 border border-foreground/10 dark:border-white/20 shadow-md animate-fade-in">
              <NarratorAvatar characterId={characterId} isSpeaking={false} />
              <div className="text-center sm:text-left min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-white/70 mb-1">
                  {t("ai.choose_storyteller")}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-foreground dark:text-white">
                  {t(`ai.characters.${characterId}`)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {CHARACTER_KEYS.map((id) => {
                const color = CHAR_COLORS[id];
                const name = t(`ai.characters.${id}`);
                const active = characterId === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setCharacterId(id);
                      // Warm up speech engine on first user gesture so iOS / Android
                      // narration starts instantly when Play is pressed later.
                      import("@/lib/browserTts").then(({ warmUpBrowserTts }) =>
                        warmUpBrowserTts(),
                      );
                    }}
                    onMouseEnter={() => startPreview(id)}
                    onMouseLeave={stopPreview}
                    onFocus={() => startPreview(id)}
                    onBlur={stopPreview}
                    className={`px-4 py-3 rounded-xl flex items-center gap-2 transition-all hover:scale-105 ${
                      active
                        ? "ring-2 ring-primary shadow-lg scale-105 bg-primary/10 dark:bg-white/25"
                        : "bg-muted hover:bg-muted/70 dark:bg-white/10 dark:hover:bg-white/20 border border-foreground/10 dark:border-white/20"
                    } ${previewCharacterId === id ? "ring-2 ring-kids-softPurple" : ""}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                        previewCharacterId === id ? "animate-pulse" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-white font-extrabold">{name[0]}</span>
                    </div>
                    <span className="font-bold text-foreground dark:text-white">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <RadioGroup
              title={t("ai.story_theme")}
              keys={THEME_KEYS}
              tBase="ai.themes"
              value={themeId}
              onChange={(v) => setThemeId(v as typeof themeId)}
              emojis={Object.fromEntries(
                THEME_KEYS.map((k) => [k, THEME_STYLES[k].emoji]),
              )}
            />
            <RadioGroup
              title={t("ai.age_range")}
              keys={AGE_KEYS}
              tBase="ai.ages"
              value={ageId}
              onChange={(v) => setAgeId(v as typeof ageId)}
              emojis={Object.fromEntries(
                AGE_KEYS.map((k) => [k, AGE_STYLES[k].emoji]),
              )}
            />
            <RadioGroup
              title={t("ai.story_length")}
              keys={LENGTH_KEYS}
              tBase="ai.lengths"
              value={lengthId}
              onChange={(v) => setLengthId(v as typeof lengthId)}
            />
            <div>
              <h4 className="font-bold mb-1 text-foreground dark:text-white">
                {t("ai.custom_elements")}:
              </h4>
              <p className="text-xs mb-2 text-foreground/70 dark:text-white/70">
                {t("page_ai_storyteller.add_any_prompt_or_idea_you_want_the_stor", "Add any prompt or idea you want the story to focus on — it will automatically follow the course criteria (SPEC, 4-act, Piaget, Bowlby, Bibliotherapy).")}
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={t("ai.custom_placeholder")}
                className="w-full px-4 py-3 rounded-xl border border-foreground/20 dark:border-white/30 bg-background dark:bg-white/15 backdrop-blur-sm text-foreground dark:text-white font-semibold placeholder:text-muted-foreground dark:placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-primary/60 dark:focus:ring-white/60 resize-none h-[130px]"
              />
            </div>
          </div>

          <div className="text-center space-y-3">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground dark:text-white bg-white/60 dark:bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-foreground/10 dark:border-white/20">
              <input type="checkbox" checked={selMode} onChange={(e) => setSelMode(e.target.checked)} />
              🌙 SEL Story Mode (Piaget · Bowlby · Bibliotherapy)
            </label>
            <div>
            <button
              onClick={selMode ? handleGenerateSel : handleGenerate}
              disabled={generating || limitReached}
              className={`px-6 sm:px-8 py-3 sm:py-4 bg-primary text-primary-foreground rounded-full font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto ${
                generating || limitReached ? "opacity-60 cursor-not-allowed" : "hover:bg-opacity-90"
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("ai.generating")}
                </>
              ) : limitReached ? (
                <>
                  <Lock className="h-5 w-5" />
                  {t("page_ai_storyteller.monthly_limit_reached", "Monthly limit reached")}
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  {t("ai.generate")}
                </>
              )}
            </button>
            </div>

            {/* Live progress timeline while generating */}
            {generating && (
              <div className="mt-4 mx-auto max-w-md p-3 sm:p-4 rounded-xl bg-white/70 dark:bg-white/10 border border-foreground/10 dark:border-white/20 text-left rtl:text-right">
                {(() => {
                  const steps: { id: GenStep; label: string }[] = [
                    { id: "planning", label: t("page_ai_storyteller.planning", "Planning") },
                    { id: "writing", label: t("page_ai_storyteller.writing", "Writing") },
                    { id: "evaluating", label: t("page_ai_storyteller.preparing_audio_review", "Preparing audio & review") },
                    { id: "saving", label: t("page_ai_storyteller.saving", "Saving") },
                  ];
                  const order: GenStep[] = ["planning", "writing", "evaluating", "saving"];
                  const idx = Math.max(0, order.indexOf(genStep));
                  const pct = ((idx + 1) / order.length) * 100;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <p className="text-sm font-bold text-foreground dark:text-white">
                          {t("page_ai_storyteller.generating_your_story", "Generating your story…")}
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-foreground/10 dark:bg-white/15 overflow-hidden mb-3">
                        <div
                          className="h-full bg-primary transition-all duration-700 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <ul className="space-y-1.5">
                        {steps.map((s, i) => {
                          const done = i < idx;
                          const active = i === idx;
                          return (
                            <li key={s.id} className="flex items-center gap-2 text-xs sm:text-sm">
                              {done ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : active ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <span className="h-4 w-4 rounded-full border border-foreground/30 dark:border-white/30" />
                              )}
                              <span className={done || active ? "font-bold text-foreground dark:text-white" : "text-muted-foreground dark:text-white/60"}>
                                {s.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {customPrompt.trim() && (
                        <div className="mt-3 pt-3 border-t border-foreground/10 dark:border-white/15">
                          <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground dark:text-white/60 mb-1">
                            {t("page_ai_storyteller.your_story_is_about_2", "Your story is about")}
                          </p>
                          <p className="text-xs sm:text-sm text-foreground/90 dark:text-white/90 line-clamp-3">
                            "{customPrompt.trim()}"
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {lastError && !generating && (
              <div className="mt-4 mx-auto max-w-md p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-left rtl:text-right">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-destructive dark:text-red-300">
                      {normalizedError?.category === "AI_TEMPORARILY_UNAVAILABLE"
                        ? t("page_ai_storyteller.story_service_busy_title", "Najmah is a little busy right now")
                        : normalizedError?.category === "NETWORK_TEMPORARY_FAILURE"
                          ? t("page_ai_storyteller.connection_problem_title", "We couldn't reach Najmah")
                          : normalizedError?.category === "STORY_QUOTA_EXCEEDED"
                            ? t("page_ai_storyteller.story_quota_title", "Story limit reached")
                            : normalizedError?.category === "INSUFFICIENT_CREDITS"
                              ? t("page_ai_storyteller.illustration_credits_title", "Not enough illustration credits")
                              : t("page_ai_storyteller.couldn_t_generate_the_story_right_now", "Couldn't generate the story right now")}
                    </p>
                    {/* Friendly, user-safe copy only — normalized centrally. */}
                    <p className="text-xs text-muted-foreground dark:text-white/70 mt-1">{lastError}</p>
                  </div>
                </div>

                {/* 402: actionable choices */}
                {errorDetails?.status === 402 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Link
                      to="/pricing"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      {t("page_ai_storyteller.upgrade_plan", "Upgrade plan")}
                    </Link>
                    {(errorDetails?.code === "ai_credits_exhausted" || errorDetails?.reason === "ai_provider_quota") && (
                      <Link
                        to="/account/api-keys"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 transition"
                      >
                        <Crown className="h-3.5 w-3.5" />
                        {t("page_ai_storyteller.use_your_own_key", "Use your own API key")}
                      </Link>
                    )}
                    {story && (
                      <button
                        onClick={handlePlayPause}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        {t("page_ai_storyteller.use_free_listen", "Use free Listen")}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (lastModeRef.current === "classic") handleGenerate();
                      else handleGenerateSel();
                    }}
                    disabled={generating || planning || limitReached}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full font-bold text-sm shadow hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("page_ai_storyteller.try_again", "Try again")}
                  </button>
                  {errorDetails && (
                    <button
                      onClick={() => setShowErrorDetails((s) => !s)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-muted-foreground dark:text-white/70 hover:text-foreground dark:hover:text-white"
                    >
                      {showErrorDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {t("page_ai_storyteller.developer_details", "Developer details")}
                    </button>
                  )}
                </div>

                {showErrorDetails && errorDetails && (
                  <pre className="mt-3 max-h-48 overflow-auto text-[10px] sm:text-xs leading-snug p-2 rounded-lg bg-black/80 text-green-200 font-mono whitespace-pre-wrap break-all">
{JSON.stringify({
  status: errorDetails.status,
  code: errorDetails.code,
  reason: errorDetails.reason,
  requestId: errorDetails.requestId,
  retryAfterSec: errorDetails.retryAfterSec,
  message: errorDetails.message,
  raw: errorDetails.raw,
}, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (
        <div className="bg-white dark:bg-white/10 backdrop-blur-md border border-foreground/10 dark:border-white/20 rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-wrap justify-between items-center mb-4 sm:mb-6 gap-3">
            <h3 className="text-lg sm:text-xl font-extrabold text-foreground dark:text-white">{t("ai.your_story")}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {!guestMode && activeVoiceSource && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${
                    activeVoiceSource === "hd"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                      : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40"
                  }`}
                >
                  {activeVoiceSource === "hd" ? (
                    <Crown className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {activeVoiceSource === "hd"
                    ? t("ai.voice_source_hd", "ElevenLabs HD")
                    : t("ai.voice_source_browser", "Browser TTS")}
                  {narrationState === "playing" && (
                    <span className="relative flex h-2 w-2 ms-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                    </span>
                  )}
                </span>
              )}
              {!guestMode && (
                /* Listening controls degrade on their own — a voice problem
                   never makes the story itself unusable. */
                <SectionErrorBoundary
                  sectionLabel={t("page_ai_storyteller.audio_unavailable", "Listening isn't available right now")}
                  hint={t("page_ai_storyteller.audio_unavailable_hint", "You can still read and download the story.")}
                >
                  <BrowserNarratorSettings
                    language={lang}
                    onChange={() => {
                      // Restart if currently playing so new speed/voice takes effect.
                      if (narrationState === "playing" || narrationState === "paused") {
                        stopAllNarration();
                      }
                    }}
                  />
                </SectionErrorBoundary>
              )}
              {!guestMode && (
                <button
                  onClick={handlePlayPause}
                  disabled={narrationState === "loading"}
                  className="p-2 rounded-full bg-white/30 dark:bg-white/20 backdrop-blur-sm border border-white/40 dark:border-white/30 text-glass dark:text-white hover:bg-white/40 dark:hover:bg-white/30 transition-colors disabled:opacity-60"
                  title={
                    narrationState === "playing"
                      ? t("ai.pause_story", "Pause")
                      : narrationState === "paused"
                      ? t("ai.resume_story", "Resume")
                      : t("ai.listen_story")
                  }
                  aria-label={t("ai.listen_story")}
                >
                  {narrationState === "loading" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : narrationState === "playing" ? (
                    <Pause className="h-5 w-5" />
                  ) : narrationState === "paused" ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
              )}
              {!guestMode && (narrationState === "playing" || narrationState === "paused") && (
                <button
                  onClick={stopAllNarration}
                  className="p-2 rounded-full bg-destructive/80 hover:bg-destructive backdrop-blur-sm border border-white/40 dark:border-white/30 text-destructive-foreground transition-colors"
                  title={t("ai.stop_story", "Stop")}
                  aria-label={t("ai.stop_story", "Stop")}
                >
                  <Square className="h-5 w-5" fill="currentColor" />
                </button>
              )}
            </div>

          </div>

          <div className="prose prose-base sm:prose-lg max-w-none">
            <div className="bg-kids-softYellow p-4 sm:p-6 rounded-xl mb-4 sm:mb-6">
              <div className="flex items-center gap-3 sm:gap-4 mb-2">
                <NarratorAvatar
                  characterId={characterId}
                  isSpeaking={narrationState === "playing"}
                />
                <div className="min-w-0">
                  <p className="font-extrabold text-kids-midnight text-base sm:text-lg">
                    {charName} {t("ai.says")}
                  </p>
                  <p className="text-xs sm:text-sm text-kids-midnight/70 font-semibold">
                    {t("ai.story_for", {
                      theme: t(`ai.themes.${themeId}`).toLowerCase(),
                      age: t(`ai.ages.${ageId}`),
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Cover illustration (or loader while it's being drawn) */}
            {(illustrating || guestIllustrating) && illustrations.length === 0 && (
              <div className="w-full h-48 sm:h-64 mb-6 rounded-2xl bg-kids-softPurple/30 dark:bg-white/5 flex flex-col items-center justify-center gap-2 text-primary font-bold animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>{t("page_ai_storyteller.drawing_the_story", "✨ Drawing the story...")}</span>
              </div>
            )}
            {illustrations[0]?.imageUrl && (
              <img
                src={illustrations[0].imageUrl}
                alt=""
                className="w-full max-h-[420px] object-cover rounded-2xl mb-6 shadow-lg"
              />
            )}

            <div className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-foreground dark:text-white font-bold">{story}</div>

            {/* Additional scene illustrations (paid tier). Pages that are still
                pending or failed simply don't render here — completed pictures
                stay visible and the story remains fully usable. */}
            {(illustrations?.length ?? 0) > 1 && (
              <SectionErrorBoundary
                sectionLabel={t("page_ai_storyteller.pictures_unavailable", "Some pictures couldn't be shown")}
                hint={t(
                  "page_ai_storyteller.pictures_unavailable_hint",
                  "Your story is safe — you can try drawing the missing pictures again.",
                )}
              >
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(illustrations ?? []).slice(1).map((ill, i) =>
                    ill?.imageUrl ? (
                      <img
                        key={i}
                        src={ill.imageUrl}
                        alt=""
                        className="w-full h-32 sm:h-40 object-cover rounded-xl shadow"
                      />
                    ) : null,
                  )}
                </div>
              </SectionErrorBoundary>
            )}

            {illustrationsGated && (
              <div className="mt-4 p-3 rounded-xl bg-kids-softPurple/30 dark:bg-white/10 border border-foreground/10 dark:border-white/20 flex items-center gap-2 text-xs sm:text-sm font-semibold">
                <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-foreground dark:text-white/90">
                  {t("page_ai_storyteller.upgrade_to_get_an_illustration_for_every", "Upgrade to get an illustration for every scene")}
                </span>
              </div>
            )}

            {/* Guest upsell: after free text, let the user pick Images or Audio (both require subscription) */}
            {guestMode && story && (
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-pink-50 dark:from-white/5 dark:to-white/10 border border-amber-200/60 dark:border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <h3 className="font-extrabold text-foreground dark:text-white">
                    {isAr ? "تحب تنشر قصتك وتحصل على نسختك؟" : "Want to publish your story and get your copy?"}
                  </h3>
                </div>
                <p className="text-sm text-foreground/80 dark:text-white/80 mb-4">
                  {isAr
                    ? "اشترك علشان تضيف الميزة اللي تحبها — صور ملوّنة للقصة أو سرد صوتي بصوت ساحر. اختار واحدة وكمّل."
                    : "Subscribe to add the feature you love — colorful illustrations or a magical voice narration. Pick one to continue."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    to="/pricing?subscribe=parent&feature=illustrations"
                    className="p-4 rounded-xl bg-white dark:bg-white/5 border border-foreground/10 dark:border-white/20 hover:shadow-lg transition-all text-start"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wand2 className="h-5 w-5 text-pink-500" />
                      <span className="font-bold text-foreground dark:text-white">
                        {isAr ? "أضف الصور" : "Add Images"}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 dark:text-white/70">
                      {isAr ? "صور ملوّنة لكل مشهد من قصتك." : "Colorful illustrations for every scene."}
                    </p>
                  </Link>
                  <Link
                    to="/pricing?subscribe=parent&feature=audio"
                    className="p-4 rounded-xl bg-white dark:bg-white/5 border border-foreground/10 dark:border-white/20 hover:shadow-lg transition-all text-start"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Volume2 className="h-5 w-5 text-indigo-500" />
                      <span className="font-bold text-foreground dark:text-white">
                        {isAr ? "فعّل الصوت" : "Enable Audio"}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 dark:text-white/70">
                      {isAr ? "اسمع قصتك بصوت سارد جميل." : "Hear your story with a beautiful narrator."}
                    </p>
                  </Link>
                </div>
              </div>
            )}
          </div>


          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                stopAllNarration();
                setReadingOpen(true);
              }}
              className="px-6 py-3 bg-kids-softPurple text-kids-midnight rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              {t("page_ai_storyteller.reading_mode", "Reading Mode")}
            </button>
            {guestMode ? (
              <>
                <button
                  onClick={handleGuestDownloadPdf}
                  disabled={guestPdfLoading || !guestTrial}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {guestPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="h-4 w-4" />
                  )}
                  {guestPdfLoading
                    ? (t("page_ai_storyteller.building_pdf", "Building PDF..."))
                    : (t("page_ai_storyteller.download_story_pdf", "Download story PDF"))}
                </button>
                <Link
                  to="/pricing"
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 to-pink-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  {t("page_ai_storyteller.subscribe_for_unlimited_stories", "Subscribe for unlimited stories")}
                </Link>
              </>
            ) : sub.canIllustrate && sub.canExportPdf ? (
              <IllustrateButton
                count={illustrations.length}
                illustrating={illustrating}
                t={t}
                onClick={() => {
                  generateSceneIllustrations(story).catch((err) =>
                    console.error("illustration generation failed", err),
                  );
                }}
              />
            ) : (
              <PremiumBadge featureKey="illustrations" size="lg" />
            )}

            {!guestMode && story && (
              <button
                onClick={() => {
                  const rawTitle = `${t(`ai.themes.${themeId}`)} • ${t(`ai.characters.${characterId}`)}`;
                  const safe = rawTitle.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "story";
                  const blob = new Blob([story], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${safe}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(t("page_ai_storyteller.txt_downloaded", "Story .txt downloaded"));
                }}
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                {t("page_ai_storyteller.download_story_txt", "Download story (.txt)")}
              </button>
            )}

            {!guestMode && story && (sub.canExportPdf || isAdmin) && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {pdfLoading
                  ? t("page_ai_storyteller.building_pdf", "Building PDF...")
                  : t("page_ai_storyteller.download_story_pdf", "Download story PDF")}
                {isAdmin && !sub.canExportPdf ? " (owner)" : ""}
              </button>
            )}
            {!guestMode && story && !sub.canExportPdf && !isAdmin && (
              <PremiumBadge featureKey="pdf" size="lg" />
            )}

            {!guestMode && story && (
              <button
                onClick={handleDownloadMp3}
                disabled={mp3Loading}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                title={t("page_ai_storyteller.mp3_hint", "Free voice download — 10 to 30 seconds")}
              >
                {mp3Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {mp3Loading
                  ? t("page_ai_storyteller.building_mp3", "Generating audio…")
                  : t("page_ai_storyteller.download_story_mp3", "Download story MP3")}
              </button>
            )}




            <button
              onClick={() => {
                stopAllNarration();
                setStory("");
                setIllustrations([]);
                setIllustrationsGated(false);
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow hover:shadow-lg transition-all"
            >
              {t("ai.create_another")}
            </button>
            <button
              onClick={() => {
                stopAllNarration();
                setStory("");
                setIllustrations([]);
                setIllustrationsGated(false);
              }}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-full font-bold shadow hover:shadow-lg transition-all border border-foreground/10 dark:border-white/20"
            >
              {t("ai.back_to_narrators", "Back to Narrators")}
            </button>
          </div>

          {readingOpen && (
            <ReadingMode
              title={`${t(`ai.themes.${themeId}`)} • ${t(`ai.characters.${characterId}`)}`}
              chapters={splitIntoScenes(story, 6)}
              images={illustrations.map((i) => i.imageUrl)}
              language={lang}
              onClose={() => setReadingOpen(false)}
            />
          )}
        </div>
      )}
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason={
          limitStories
            ? t("upgrade_modal.reason_used_all", "You've used all {{count}} stories on your current plan this month.", { count: limitStories })
            : undefined
        }
      />
    </div>
  );
};

const RadioGroup = ({
  title,
  keys,
  tBase,
  value,
  onChange,
  emojis,
}: {
  title: string;
  keys: readonly string[];
  tBase: string;
  value: string;
  onChange: (v: string) => void;
  emojis?: Record<string, string>;
}) => {
  const { t } = useTranslation();
  return (
    <div>
      <h4 className="font-bold mb-3 text-foreground dark:text-white">{title}:</h4>
      <div className="space-y-2">
        {keys.map((id) => (
          <label
            key={id}
            className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border hover:scale-[1.02] ${
              value === id
                ? "bg-primary/10 dark:bg-white/25 border-primary dark:border-white/60 shadow-md"
                : "bg-muted dark:bg-white/10 border-foreground/10 dark:border-white/20 hover:bg-muted/70 dark:hover:bg-white/20"
            }`}
          >
            <input
              type="radio"
              checked={value === id}
              onChange={() => onChange(id)}
              className="hidden"
            />
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                value === id ? "border-primary dark:border-white" : "border-muted-foreground dark:border-white/50"
              }`}
            >
              {value === id && <div className="w-3 h-3 rounded-full bg-primary dark:bg-white" />}
            </div>
            {emojis?.[id] && (
              <span className="text-lg" aria-hidden="true">
                {emojis[id]}
              </span>
            )}
            <span className="text-foreground dark:text-white font-bold">{t(`${tBase}.${id}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default AIStoryteller;
