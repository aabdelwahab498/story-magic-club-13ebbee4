import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Volume2, Loader2, ChevronLeft, ChevronRight, X, Images, Pause, ArrowRight, Headphones, Sparkles, Wand2, Check, Crown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalized, type Multilingual } from "@/lib/multilingual";
import { toast } from "sonner";
import NarratorPicker from "@/components/NarratorPicker";
import NarratorAvatar from "@/components/NarratorAvatar";
import type { NarratorId } from "@/lib/narrators";
import type { BrowserTtsHandle } from "@/lib/browserTts";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserStories } from "@/hooks/useStories";
import { generateTrialPdf, downloadTrialPdf, prepareTrialPdfDownloadTarget } from "@/lib/trialStoryApi";
import type { SelStoryResponse } from "@/lib/selStoryApi";
import { synthesizeDynamicTts } from "@/api/audio.api";

interface DBStory {
  id: string;
  title: Multilingual;
  description: Multilingual;
  content: Multilingual;
  image: string | null;
  age_range: string | null;
  duration: string | null;
  gallery: string[] | null;
  created_by: string | null;
  author_name?: string | null;
}

const DEFAULT_NARRATOR: NarratorId = "wizard";

const StoryLibrary = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const sub = useSubscription();
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [ideaNarrator, setIdeaNarrator] = useState<NarratorId>(DEFAULT_NARRATOR);
  const [stories, setStories] = useState<DBStory[]>([]);
  const [selected, setSelected] = useState<DBStory | null>(null);
  const { data: userStories, isLoading: loading } = useUserStories();
  const [narrating, setNarrating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lastGenerated, setLastGenerated] = useState<SelStoryResponse | null>(null);
  const [lastPdfLoading, setLastPdfLoading] = useState(false);

  // Pick up the most recently generated story (persisted from /ai-storyteller) so
  // users can re-download its .txt / PDF without leaving /stories.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("last-generated-sel-story");
      if (!raw) {
        console.log("[StoryLibrary] no last-generated-sel-story in localStorage");
        return;
      }
      const parsed = JSON.parse(raw) as { story: SelStoryResponse; ts: number };
      if (parsed?.story?.pages?.length) {
        setLastGenerated(parsed.story);
        console.log("[StoryLibrary] loaded last generated story → showing download card", {
          title: parsed.story.title,
          pages: parsed.story.pages.length,
          ts: parsed.ts,
        });
      }
    } catch (err) {
      console.warn("[StoryLibrary] failed to parse last-generated-sel-story", err);
    }
  }, []);



  // Per-story narrator selection so each card remembers the child's choice
  const [narratorByStory, setNarratorByStory] = useState<Record<string, NarratorId>>({});
  const ttsRef = useRef<BrowserTtsHandle | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Hover preview narration (inside the idea panel)
  const previewTtsRef = useRef<BrowserTtsHandle | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);

  const getNarrator = (id: string): NarratorId =>
    narratorByStory[id] || DEFAULT_NARRATOR;

  const setNarrator = (storyId: string, narrator: NarratorId) => {
    setNarratorByStory((m) => ({ ...m, [storyId]: narrator }));
  };

  useEffect(() => {
    const loadAuthorsAndSet = async () => {
      if (!userStories) return;
      
      const creatorIds = Array.from(
        new Set(userStories.map((s) => s.created_by).filter((v): v is string => !!v)),
      );
      let authorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", creatorIds);
        authorMap = Object.fromEntries(
          (profs ?? []).map((p) => [
            p.user_id as string,
            (p.display_name as string | null)?.trim() || "",
          ]),
        );
      }
      const enriched = userStories.map((s) => ({
        ...s,
        author_name: s.created_by ? authorMap[s.created_by] || "" : "",
      }));
      setStories(enriched);
      setSelected((prev) => prev || (enriched.length > 0 ? enriched[0] : null));
    };
    loadAuthorsAndSet();
  }, [userStories]);

  // Keyboard navigation for the lightbox
  useEffect(() => {
    if (lightboxIndex === null || !selected?.gallery) return;
    const total = selected.gallery.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? 0 : (i + 1) % total));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? 0 : (i - 1 + total) % total));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, selected]);

  const stopNarration = useCallback(() => {
    if (ttsRef.current) {
      ttsRef.current.cancel();
      ttsRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    setIsPlaying(false);
    setNarrating(false);
  }, [setIsPlaying, setNarrating]);

  // Cancel any in-flight narration when leaving the page
  useEffect(() => {
    return () => stopNarration();
  }, [stopNarration]);

  const stopPreview = () => {
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewTtsRef.current) {
      previewTtsRef.current.cancel();
      previewTtsRef.current = null;
    }
  };

  const generateAudioBook = async () => {
    if (!selected) return;
    if (isPlaying) {
      stopNarration();
      return;
    }
    const narratorId = getNarrator(selected.id);
    const text =
      getLocalized(selected.content, lang) ||
      getLocalized(selected.description, lang) ||
      getLocalized(selected.title, lang);
    if (!text) {
      toast.error(t("ai.errors.generic"));
      return;
    }

    setGeneratingAudio(true);
    try {
      const data = await synthesizeDynamicTts({
        text,
        language: lang,
        character: narratorId,
      });
      if (!data || !data.audioContent) {
        toast.message(t("stories.audio_fallback", "Using browser voice as fallback"));
        await playStory();
        return;
      }
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audioElRef.current = audio;
      audio.onended = () => {
        audioElRef.current = null;
        setIsPlaying(false);
      };
      audio.onerror = () => {
        audioElRef.current = null;
        setIsPlaying(false);
      };
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      toast.message(t("stories.audio_fallback", "Using browser voice as fallback"));
      await playStory();
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handlePreviewCharacter = async (character: NarratorId) => {
    stopPreview();
    previewTimeoutRef.current = window.setTimeout(async () => {
      previewTimeoutRef.current = null;
      // Use the active UI language so the preview matches what the child reads.
      const phrase = t(`ai.characters.${character}`);
      const { warmUpBrowserTts, speakWithBrowser } = await import("@/lib/browserTts");
      warmUpBrowserTts();
      try {
        const handle = await speakWithBrowser({
          text: phrase,
          language: lang,
          character,
        });
        previewTtsRef.current = handle;
      } catch { /* ignore preview errors */ }
    }, 350);
  };
  const playStory = async () => {
    if (!selected) return;
    if (isPlaying) {
      stopNarration();
      return;
    }

    const narratorId = getNarrator(selected.id);
    const text =
      getLocalized(selected.content, lang) ||
      getLocalized(selected.description, lang) ||
      getLocalized(selected.title, lang);

    if (!text) {
      toast.error(t("ai.errors.generic"));
      return;
    }

    setNarrating(true);
    try {
      const { isBrowserTtsSupported, speakWithBrowser } = await import("@/lib/browserTts");
      if (!isBrowserTtsSupported()) {
        toast.error(t("ai.errors.generic"));
        setNarrating(false);
        return;
      }
      const handle = await speakWithBrowser({
        text,
        language: lang,
        character: narratorId,
        ageId: selected.age_range || undefined,
        onEnd: () => {
          ttsRef.current = null;
          setIsPlaying(false);
        },
        onError: () => {
          ttsRef.current = null;
          setIsPlaying(false);
        },
      });
      ttsRef.current = handle;
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      toast.error(t("ai.errors.generic"));
    } finally {
      setNarrating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-3 text-muted-foreground">{t("stories.loading")}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" key={lang}>
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-kids-midnight mb-6 sm:mb-8 px-2">
        {t("stories.library_title")}
      </h2>

      {/* Tell us your idea — generate a full SEL story (images + PDF + scenes + narration) */}
      <div className="mb-8 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-primary/15 via-kids-softPurple/40 to-kids-softYellow/40 dark:from-primary/20 dark:via-primary/10 dark:to-transparent border-2 border-primary/30 shadow-lg">
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-extrabold text-kids-midnight">
              {t("stories.idea_title", "Tell us your idea")}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t(
                "stories.idea_subtitle",
                "We'll turn your idea into a full story — with illustrations, a PDF, and scenes {{narrator}} reads aloud, all aligned with the course criteria.",
                { narrator: t(`ai.characters.${ideaNarrator}`) },
              )}
            </p>
          </div>
        </div>
        <textarea
          value={ideaPrompt}
          onChange={(e) => setIdeaPrompt(e.target.value)}
          rows={3}
          placeholder={t("page_story_library.e_g_a_story_about_a_brave_little_fox_who", "e.g. A story about a brave little fox who learns to share...")}
          className="w-full rounded-xl border-2 border-primary/30 bg-background/80 backdrop-blur p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />

        {/* Narrator picker for the idea panel */}
        <div className="mt-3 p-3 rounded-xl bg-background/60 border border-primary/20">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            {t("stories.choose_narrator", "Choose your narrator")}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <NarratorAvatar characterId={ideaNarrator} isSpeaking={false} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-kids-midnight mb-2">
                {t(`ai.characters.${ideaNarrator}`)}
              </p>
              <NarratorPicker value={ideaNarrator} onChange={setIdeaNarrator} size="sm" onHover={handlePreviewCharacter} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 mt-3">
          <button
            type="button"
            onClick={() => {
              const idea = ideaPrompt.trim();
              if (!idea) {
                toast.error(t("stories.idea_required", "Please write your idea first"));
                return;
              }
              const pending = { idea, narrator: ideaNarrator, ts: Date.now() };
              try { localStorage.setItem("pending-story-idea", JSON.stringify(pending)); } catch { /* intentionally ignored */ }

              // Not signed in → go to auth, then back to pricing (audio requires subscription)
              if (!user) {
                navigate("/auth", { state: { from: "/pricing?subscribe=parent&feature=audio" } });
                toast.info(t("stories.signin_to_generate", "Please sign in, then subscribe to generate your audio story."));
                return;
              }
              // Signed in but no audio capability / free tier → go subscribe first (owner bypass)
              if (!isAdmin && !sub.loading && (!sub.canAudio || sub.tier === "free")) {
                navigate("/pricing?subscribe=parent&feature=audio");
                toast.info(t("stories.subscribe_to_generate", "Subscribe to generate your full audio story. We'll resume right after."));
                return;
              }
              // Subscribed → generate immediately
              try { localStorage.removeItem("pending-story-idea"); } catch { /* intentionally ignored */ }
              navigate("/ai-storyteller", { state: { idea, autoGenerate: true, narrator: ideaNarrator } });
            }}
            className="px-5 py-2.5 rounded-full inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold shadow-md hover:scale-[1.03] transition-transform"
          >
            <Wand2 className="h-4 w-4" />
            {t("stories.generate_from_idea", "Generate my story")}
          </button>
        </div>
      </div>

      {lastGenerated && (
        <div className="mb-8 mx-auto max-w-3xl rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-indigo-950/40 shadow-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300">
              {t("stories.last_story_ready", "Your latest story is ready — download it now")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3 truncate">{lastGenerated.title}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const header = `${lastGenerated.title}\n\n`;
                const body = lastGenerated.pages
                  .map((p) => `— Page ${p.index} —\n${p.text}`)
                  .join("\n\n");
                const footer = lastGenerated.sel_outcome?.statement
                  ? `\n\n---\n${lastGenerated.sel_outcome.statement}\n`
                  : "";
                const text = header + body + footer;
                const safe = (lastGenerated.title || "story")
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
                console.log("[StoryLibrary] TXT downloaded", safe);
                toast.success(t("page_ai_storyteller.txt_downloaded", "Story .txt downloaded"));
              }}
              className="px-6 py-3 text-base bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full font-extrabold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
            >
              <Download className="h-5 w-5" />
              {t("page_ai_storyteller.download_story_txt", "Download story (.txt)")}
            </button>

            {(sub.canExportPdf || isAdmin) ? (
              <button
                onClick={async () => {
                  const downloadTarget = prepareTrialPdfDownloadTarget();
                  setLastPdfLoading(true);
                  try {
                    const pdf = await generateTrialPdf({
                      title: lastGenerated.title,
                      pages: lastGenerated.pages.map((p) => ({
                        index: p.index,
                        text: p.text,
                        emotionTag: p.emotionTag,
                        imageUrl: p.imageUrl ?? null,
                      })),
                      selStatement: lastGenerated.sel_outcome?.statement,
                    });
                    const safe = (lastGenerated.title || "story")
                      .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
                      .replace(/\s+/g, "-")
                      .slice(0, 60) || "story";
                    downloadTrialPdf(pdf.pdfBase64, `${safe}.pdf`, downloadTarget);
                    console.log("[StoryLibrary] PDF downloaded", safe);
                    toast.success(t("page_ai_storyteller.your_pdf_is_ready", "Your PDF is ready ✨"));
                  } catch (e) {
                    try { downloadTarget?.close(); } catch { /* ignore */ }
                    console.error("[StoryLibrary] PDF failed", e);
                    toast.error(t("page_ai_storyteller.could_not_build_the_pdf_please_try_again", "Could not build the PDF — please try again in a moment."));
                  } finally {
                    setLastPdfLoading(false);
                  }
                }}
                disabled={lastPdfLoading}
                className="px-6 py-3 text-base bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-extrabold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 disabled:opacity-60"
              >
                {lastPdfLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
                {lastPdfLoading
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
      )}



      {selected && (
        <div className="bg-card rounded-2xl shadow-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="flex flex-col">
              <h3 className="text-xl sm:text-2xl font-bold text-kids-midnight mb-2">
                {getLocalized(selected.title, lang)}
              </h3>
              <p className="text-sm text-muted-foreground mb-3 italic">
                {t("stories.written_by", "Written by")}:{" "}
                <span className="font-semibold not-italic text-foreground">
                  {selected.author_name?.trim() ||
                    t("stories.default_author", "NajmaH Team")}
                </span>
              </p>
              <p className="text-muted-foreground mb-4">
                {getLocalized(selected.description, lang)}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                {selected.age_range && (
                  <div className="bg-kids-softYellow px-3 py-1 rounded-full text-sm">
                    {t("stories.age_label")}: {selected.age_range}
                  </div>
                )}
                {selected.duration && (
                  <div className="bg-kids-softGreen px-3 py-1 rounded-full text-sm">
                    {selected.duration}
                  </div>
                )}
              </div>

              {/* Narrator chooser + live preview avatar */}
              <div className="mb-6 p-4 rounded-xl bg-muted/50 border border-foreground/10">
                <div className="flex items-center gap-4">
                  <NarratorAvatar
                    characterId={getNarrator(selected.id)}
                    isSpeaking={isPlaying}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                      {t("stories.choose_narrator", "Choose your narrator")}
                    </p>
                    <p className="text-base font-extrabold text-kids-midnight mb-2">
                      {t(`ai.characters.${getNarrator(selected.id)}`)}
                    </p>
                    <NarratorPicker
                      value={getNarrator(selected.id)}
                      onChange={(id) => {
                        // If switching while playing, restart with the new voice
                        const wasPlaying = isPlaying;
                        stopNarration();
                        setNarrator(selected.id, id);
                        if (wasPlaying) {
                          // small delay to let speechSynthesis fully cancel
                          setTimeout(() => playStory(), 80);
                        }
                      }}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <button
                  onClick={playStory}
                  disabled={narrating || generatingAudio}
                  className={`px-6 py-3 rounded-full inline-flex items-center gap-2 text-white transition-all ${
                    isPlaying ? "bg-kids-orange" : "bg-primary"
                  } ${narrating || generatingAudio ? "opacity-70" : ""}`}
                >
                  {narrating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                  {isPlaying ? t("stories.pause_story") : t("stories.play_story")}
                </button>

                <button
                  onClick={generateAudioBook}
                  disabled={generatingAudio || narrating}
                  className={`px-6 py-3 rounded-full inline-flex items-center gap-2 bg-kids-purple text-white transition-all ${
                    generatingAudio || narrating ? "opacity-70" : ""
                  }`}
                  title={t("stories.generate_audio_book_hint", "Premium narration with character voices")}
                >
                  {generatingAudio ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Headphones className="h-5 w-5" />
                  )}
                  {t("stories.generate_audio_book", "Generate Audio Book")}
                </button>
              </div>
            </div>

            <div className="relative">
              {selected.image && (
                <img
                  src={selected.image}
                  alt={getLocalized(selected.title, lang)}
                  className="w-full h-64 md:h-80 object-cover rounded-xl shadow-md"
                />
              )}
            </div>
          </div>

          {selected.gallery && selected.gallery.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <Images className="h-5 w-5 text-primary" />
                <h4 className="text-lg font-bold text-kids-midnight">
                  {t("stories.chapter_gallery", "Chapter Gallery")}
                </h4>
                <span className="text-sm text-muted-foreground ms-auto">
                  {selected.gallery.length} {t("stories.images", "images")}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {selected.gallery.map((url, idx) => (
                  <button
                    key={url}
                    onClick={() => setLightboxIndex(idx)}
                    className="group relative aspect-square overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`${t("stories.chapter", "Chapter")} ${idx + 1}`}
                  >
                    <img
                      src={url}
                      alt={`${getLocalized(selected.title, lang)} — ${t("stories.chapter", "Chapter")} ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-start p-2">
                      <span className="text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity bg-primary/80 px-2 py-1 rounded-full">
                        {idx + 1}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && selected?.gallery && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label={t("common.close", "Close")}
          >
            <X className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const total = selected.gallery!.length;
              setLightboxIndex((i) => (i === null ? 0 : (i - 1 + total) % total));
            }}
            className="absolute start-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label={t("stories.previous", "Previous")}
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const total = selected.gallery!.length;
              setLightboxIndex((i) => (i === null ? 0 : (i + 1) % total));
            }}
            className="absolute end-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label={t("stories.next", "Next")}
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </button>
          <div
            className="relative max-w-5xl max-h-[85vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected.gallery[lightboxIndex]}
              alt={`${getLocalized(selected.title, lang)} — ${t("stories.chapter", "Chapter")} ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full">
              {t("stories.chapter", "Chapter")} {lightboxIndex + 1} / {selected.gallery.length}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-lg sm:text-xl font-semibold mb-4 text-kids-midnight">
        {t("stories.all_stories")}
      </h3>
      {stories.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">{t("stories.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {stories.map((s) => (
            <div
              key={s.id}
              className={`bg-card text-card-foreground dark:text-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-[1.02] ${
                selected?.id === s.id ? "ring-4 ring-primary" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  stopNarration();
                  setSelected(s);
                }}
                className="block w-full text-start"
              >
                {s.image && (
                  <div className="relative h-40">
                    <img
                      src={s.image}
                      alt={getLocalized(s.title, lang)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4 pb-2">
                  <h4 className="font-bold dark:text-white">{getLocalized(s.title, lang)}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground dark:text-white/80">{s.duration}</span>
                    <div className="flex items-center">
                      <BookOpen className="h-4 w-4 text-primary dark:text-white me-1" />
                      <span className="text-sm dark:text-white">
                        {t("stories.age_label")}: {s.age_range}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Per-card narrator picker — does not select the story when clicked */}
              <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-2">
                <NarratorPicker
                  value={getNarrator(s.id)}
                  onChange={(id) => setNarrator(s.id, id)}
                  size="sm"
                  label={t("stories.choose_narrator", "Choose your narrator")}
                  stopPropagation
                />
                <Link
                  to={`/stories/${s.id}`}
                  className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  {t("stories.view_story", "View story")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoryLibrary;
