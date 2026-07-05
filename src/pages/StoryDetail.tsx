import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Loader2, Pause, Volume2, Languages, BookMarked } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalized, type Multilingual } from "@/lib/multilingual";
import { toast } from "sonner";
import NarratorPicker from "@/components/NarratorPicker";
import NarratorAvatar from "@/components/NarratorAvatar";
import ReadingMode from "@/components/ReadingMode";
import EmbeddedVideoPlayer from "@/components/EmbeddedVideoPlayer";
import StoryBackgroundMusic from "@/components/StoryBackgroundMusic";
import type { NarratorId } from "@/lib/narrators";
import type { BrowserTtsHandle } from "@/lib/browserTts";
import Seo from "@/components/Seo";
import StoryVideoPlayer from "@/components/story/StoryVideoPlayer";
import { useGenerateClassicNarration } from "@/lib/storyTtsApi";
import { useAuth } from "@/hooks/useAuth";
import { Film, Wand2 } from "lucide-react";

interface DBStory {
  id: string;
  title: Multilingual;
  description: Multilingual;
  content: Multilingual;
  image: string | null;
  age_range: string | null;
  duration: string | null;
  gallery: string[] | null;
  video_embed_url: string | null;
  pdf_url: string | null;
  audio_url: string | null;
  category: string | null;
}

type StoryLang = "en" | "ar";

/** Split a story body into N chapter chunks. Prefers "Chapter N" / "الفصل N" markers, otherwise paragraphs. */
function splitIntoChapters(text: string, count: number): string[] {
  if (!text || count <= 0) return [];
  // Try chapter markers first
  const markerRegex = /(?=^\s*(?:Chapter|الفصل)\s+\d+)/gmi;
  const byMarker = text.split(markerRegex).map((s) => s.trim()).filter(Boolean);
  let chunks = byMarker.length > 1 ? byMarker : text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) chunks = [text];
  // Normalize to exactly `count` chunks
  if (chunks.length === count) return chunks;
  if (chunks.length > count) {
    // Merge extras into the last chunk
    const head = chunks.slice(0, count - 1);
    const tail = chunks.slice(count - 1).join("\n\n");
    return [...head, tail];
  }
  // pad by repeating last
  const out = [...chunks];
  while (out.length < count) out.push(chunks[chunks.length - 1]);
  return out;
}

const DEFAULT_NARRATOR: NarratorId = "wizard";

const StoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [story, setStory] = useState<DBStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [storyLang, setStoryLang] = useState<StoryLang>(() => (i18n.language?.startsWith("ar") ? "ar" : "en"));
  const [narrator, setNarrator] = useState<NarratorId>(DEFAULT_NARRATOR);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [narrating, setNarrating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const ttsRef = useRef<BrowserTtsHandle | null>(null);

  const [videoOpen, setVideoOpen] = useState(false);
  const { isAdmin, isEditor } = useAuth();
  const isStaff = isAdmin || isEditor;
  const generateNarration = useGenerateClassicNarration();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("id,title,description,content,image,age_range,duration,gallery,video_embed_url,pdf_url,audio_url,category")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error(t("common.error"));
      } else {
        setStory(data as unknown as DBStory);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
      stopNarration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const gallery = story?.gallery ?? [];
  const chapterCount = gallery.length || 0;

  const chaptersByLang = useMemo(() => {
    if (!story) return { en: [] as string[], ar: [] as string[] };
    const count = chapterCount || 1;
    return {
      en: splitIntoChapters(story.content?.en || "", count),
      ar: splitIntoChapters(story.content?.ar || "", count),
    };
  }, [story, chapterCount]);

  const chapters = chaptersByLang[storyLang] || [];
  const safeIdx = Math.min(chapterIdx, Math.max(0, chapterCount - 1));
  const currentImage = gallery[safeIdx];
  const currentText = chapters[safeIdx] || "";
  const currentTitle = getLocalized(story?.title, storyLang);

  const stopNarration = () => {
    if (ttsRef.current) {
      ttsRef.current.cancel();
      ttsRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setNarrating(false);
  };

  const playChapter = async () => {
    if (!story) return;
    // If currently playing, pause (do NOT cancel — keep the queue so resume works)
    if (isPlaying && !isPaused) {
      if (ttsRef.current) {
        ttsRef.current.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
      return;
    }
    // If paused, resume from where we left off
    if (isPaused && ttsRef.current) {
      ttsRef.current.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    const text = currentText || getLocalized(story.description, storyLang) || currentTitle;
    if (!text) return;
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
        language: storyLang,
        character: narrator,
        ageId: story.age_range || undefined,
        onEnd: () => {
          ttsRef.current = null;
          setIsPlaying(false);
          setIsPaused(false);
          // Signal that it's a safe moment to apply any deferred SW update.
          try { window.dispatchEvent(new Event("story:ended")); } catch { /* noop */ }
        },
        onError: () => { ttsRef.current = null; setIsPlaying(false); setIsPaused(false); },
      });
      ttsRef.current = handle;
      setIsPlaying(true);
      setIsPaused(false);
    } catch (e) {
      console.error(e);
      toast.error(t("ai.errors.generic"));
    } finally {
      setNarrating(false);
    }
  };

  const switchLang = (next: StoryLang) => {
    if (next === storyLang) return;
    stopNarration();
    setStoryLang(next);
  };

  const goChapter = (i: number) => {
    stopNarration();
    setChapterIdx(Math.max(0, Math.min(chapterCount - 1, i)));
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">{t("stories.empty", "No story found")}</p>
        <Link to="/stories" className="text-primary underline">{t("nav.stories", "Stories")}</Link>
      </div>
    );
  }

  const isRtl = storyLang === "ar";

  const desc = getLocalized(story.description, storyLang);

  return (
    <div className="animate-fade-in" dir={isRtl ? "rtl" : "ltr"}>
      <Seo
        title={`${currentTitle} — NajmaH`}
        description={desc}
        path={`/stories/${story.id}`}
        image={story.image ?? undefined}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: currentTitle,
          description: desc,
          image: story.image ?? undefined,
          inLanguage: storyLang,
          audience: { "@type": "PeopleAudience", suggestedMinAge: 3, suggestedMaxAge: 12 },
        }}
      />
      <Link
        to="/stories"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline mb-4"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("stories.back_to_library", "Back to library")}
      </Link>

      {/* Header card: cover + meta + lang toggle + play */}
      <div className="bg-card rounded-2xl shadow-xl p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {story.image && (
            <img
              src={story.image}
              alt={currentTitle}
              className="w-full h-56 sm:h-72 md:h-80 object-cover rounded-xl shadow-md animate-ken-burns"
            />
          )}
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-kids-midnight mb-2">{currentTitle}</h1>
            <p className="text-muted-foreground mb-4">{getLocalized(story.description, storyLang)}</p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {story.age_range && (
                <span className="bg-kids-softYellow px-3 py-1 rounded-full text-sm">
                  {t("stories.age_label", "Age")}: {story.age_range}
                </span>
              )}
              {story.duration && (
                <span className="bg-kids-softGreen px-3 py-1 rounded-full text-sm">{story.duration}</span>
              )}
              <span className="bg-kids-softPurple px-3 py-1 rounded-full text-sm inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {chapterCount} {t("stories.chapters", "chapters")}
              </span>
            </div>

            {/* Language toggle */}
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1">
                <Languages className="h-3.5 w-3.5" />
                {t("stories.story_language", "Story language")}
              </p>
              <div className="inline-flex rounded-full border border-border p-1 bg-muted/50">
                {(["en", "ar"] as StoryLang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => switchLang(l)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                      storyLang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "en" ? "English" : "Arabic"}
                  </button>
                ))}
              </div>
            </div>

            {/* Narrator picker */}
            <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-foreground/10">
              <div className="flex items-center gap-3">
                <NarratorAvatar characterId={narrator} isSpeaking={isPlaying} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    {t("stories.choose_narrator", "Choose your narrator")}
                  </p>
                  <NarratorPicker
                    value={narrator}
                    onChange={(n) => { stopNarration(); setNarrator(n); }}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              <button
                onClick={playChapter}
                disabled={narrating || chapterCount === 0}
                className={`px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 text-white transition-all ${
                  isPlaying ? "bg-kids-orange" : isPaused ? "bg-kids-softPurple" : "bg-primary"
                } ${narrating ? "opacity-70" : ""} disabled:opacity-50`}
              >
                {narrating ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                {isPlaying
                  ? t("stories.pause_story", "Pause")
                  : isPaused
                  ? t("stories.resume_story", "Resume")
                  : `${t("stories.play_chapter", "Play chapter")} ${safeIdx + 1}`}
              </button>
              <button
                onClick={() => { stopNarration(); setReadingOpen(true); }}
                disabled={chapterCount === 0}
                className="px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 bg-kids-softPurple text-kids-midnight font-bold transition-all disabled:opacity-50"
              >
                <BookMarked className="h-5 w-5" />
                {t("stories.reading_mode", "Reading Mode")}
              </button>
              {story.audio_url && (
                <button
                  onClick={() => { stopNarration(); setVideoOpen(true); }}
                  className="px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 bg-kids-pink text-white font-bold transition-all hover-pop"
                >
                  <Film className="h-5 w-5" />
                  {t("stories.watch_as_video", "Watch as video")}
                </button>
              )}
              {isStaff && (
                <button
                  onClick={async () => {
                    const res = await generateNarration.mutateAsync({ storyId: story.id, language: storyLang });
                    setStory((s) => s ? { ...s, audio_url: res.audio_url } : s);
                  }}
                  disabled={generateNarration.isPending}
                  className="px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-bold transition-all disabled:opacity-50"
                  title="Admin/editor only"
                >
                  {generateNarration.isPending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Wand2 className="h-5 w-5" />}
                  {story.audio_url
                    ? t("stories.regen_narration", "Regenerate narration")
                    : t("stories.gen_narration", "Generate narration")}
                </button>
              )}
            </div>
            <div className="mt-3">
              <StoryBackgroundMusic
                theme={story.category ?? "bedtime"}
                mood="calm"
                active={isPlaying}
              />
            </div>
          </div>
        </div>
      </div>

      {story.video_embed_url && (
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-kids-midnight mb-3">
            {t("stories.watch_video", "Watch the story")}
          </h2>
          <EmbeddedVideoPlayer url={story.video_embed_url} title={currentTitle} />
        </div>
      )}

      {story.pdf_url && (
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-kids-midnight">
              {t("stories.read_pdf", "Read the full storybook (PDF)")}
            </h2>
            <a
              href={story.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
            >
              {t("stories.download_pdf", "Download PDF")}
            </a>
          </div>
          <div className="rounded-2xl overflow-hidden border border-foreground/10 shadow-md bg-muted">
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(story.pdf_url)}&embedded=true`}
              title={`${currentTitle} PDF`}
              className="w-full h-[70vh] bg-white"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {chapterCount > 0 && (
        <div className="bg-card rounded-2xl shadow-xl p-4 sm:p-6">
          {/* Chapter selector */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-kids-midnight">
              {t("stories.chapters", "Chapters")}
            </h2>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <button
                onClick={() => goChapter(safeIdx - 1)}
                disabled={safeIdx === 0}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-40"
                aria-label={t("stories.previous", "Previous")}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </button>
              <span>{safeIdx + 1} / {chapterCount}</span>
              <button
                onClick={() => goChapter(safeIdx + 1)}
                disabled={safeIdx >= chapterCount - 1}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-40"
                aria-label={t("stories.next", "Next")}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 snap-x">
            {gallery.map((url, i) => (
              <button
                key={url + i}
                onClick={() => goChapter(i)}
                className={`relative shrink-0 snap-start rounded-lg overflow-hidden border-2 transition-all ${
                  i === safeIdx ? "border-primary ring-2 ring-primary/40 scale-[1.03]" : "border-transparent opacity-80 hover:opacity-100"
                }`}
                aria-label={`${t("stories.chapter", "Chapter")} ${i + 1}`}
              >
                <img src={url} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover" loading="lazy" />
                <span className="absolute bottom-1 start-1 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>

          {/* Current chapter view */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentImage && (
              <img
                src={currentImage}
                alt={`${currentTitle} — ${t("stories.chapter", "Chapter")} ${safeIdx + 1}`}
                className="w-full h-64 sm:h-80 object-cover rounded-xl shadow-md"
              />
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">
                {t("stories.chapter", "Chapter")} {safeIdx + 1}
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
                {currentText}
              </p>
            </div>
          </div>
        </div>
      )}

      {readingOpen && (
        <ReadingMode
          title={currentTitle}
          chapters={chapters.length ? chapters : [getLocalized(story.content, storyLang) || ""]}
          images={chapters.length ? gallery : [story.image || undefined]}
          language={storyLang}
          initialIndex={safeIdx}
          onClose={() => setReadingOpen(false)}
        />
      )}

      {videoOpen && story.audio_url && (
        <StoryVideoPlayer
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          audioUrl={story.audio_url}
          pages={(chapters.length ? chapters : [getLocalized(story.content, storyLang) || ""])
            .map((text, i) => ({ text, image_url: gallery[i] || story.image || null }))}
          title={currentTitle}
        />
      )}
    </div>
  );
};

export default StoryDetail;
