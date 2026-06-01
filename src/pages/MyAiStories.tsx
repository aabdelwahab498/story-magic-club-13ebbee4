import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Headphones, Film, Sparkles, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMyAiStories, type AiStoryRow } from "@/lib/aiStoryApi";
import { useGenerateFullNarration } from "@/lib/storyTtsApi";
import StoryVideoPlayer, { type StoryVideoPage } from "@/components/story/StoryVideoPlayer";
import Seo from "@/components/Seo";

const MyAiStories = () => {
  const { t } = useTranslation();
  const { data: stories = [], isLoading, refetch } = useMyAiStories();
  const generate = useGenerateFullNarration();

  const [active, setActive] = useState<{
    story: AiStoryRow;
    pages: StoryVideoPage[];
    weights?: number[];
  } | null>(null);

  const pagesFor = (s: AiStoryRow): StoryVideoPage[] => {
    if (Array.isArray(s.pages) && s.pages.length > 0) {
      return s.pages
        .map((p) => ({
          text: String(p.text ?? p.content ?? "").trim(),
          image_url: p.image_url ?? null,
        }))
        .filter((p) => p.text.length > 0);
    }
    const txt = String((s.generated_story as { text?: string })?.text ?? "");
    return txt
      .split(/\n{2,}|(?<=[\.!\?])\s+(?=[A-Z\u0600-\u06FF])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10)
      .slice(0, 12)
      .map((text) => ({ text, image_url: null }));
  };

  const openVideo = (s: AiStoryRow, weights?: number[]) => {
    setActive({ story: s, pages: pagesFor(s), weights });
  };

  const handleGenerate = async (s: AiStoryRow) => {
    const res = await generate.mutateAsync({ storyId: s.id });
    await refetch();
    openVideo({ ...s, audio_url: res.audio_url }, res.page_weights);
  };

  return (
    <div className="py-6 max-w-5xl mx-auto px-4">
      <Seo
        title="My AI Stories — NajmaH"
        description="Listen to your AI-generated stories or watch them as a narrated slideshow."
      />

      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t("my_stories.title", { defaultValue: "My AI Stories" })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("my_stories.subtitle", {
              defaultValue: "Generate full narration or watch your story as a video.",
            })}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/ai-storyteller">
            <Sparkles className="h-4 w-4 me-2" />
            {t("my_stories.create_new", { defaultValue: "Create new" })}
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
          {t("my_stories.empty", { defaultValue: "You haven't created any stories yet." })}
        </div>
      ) : (
        <ul className="grid gap-3">
          {stories.map((s) => (
            <li
              key={s.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-card rounded-2xl border border-border"
            >
              <Link to={`/my-stories/${s.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <p className="font-bold text-foreground truncate">
                  {s.title || t("my_stories.untitled", { defaultValue: "Untitled story" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()} • {s.language.toUpperCase()}
                  {s.audio_url && (
                    <span className="ms-2 inline-flex items-center gap-1 text-primary font-semibold">
                      <Headphones className="h-3 w-3" />
                      {t("my_stories.has_audio", { defaultValue: "Audio ready" })}
                    </span>
                  )}
                </p>
              </Link>

              <div className="flex gap-2 flex-wrap">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to={`/my-stories/${s.id}`}>
                    {t("my_stories.open", { defaultValue: "Open" })}
                  </Link>
                </Button>
                {s.audio_url ? (
                  <Button
                    size="sm"
                    onClick={() => openVideo(s)}
                    className="rounded-full"
                  >
                    <Film className="h-4 w-4 me-1.5" />
                    {t("my_stories.watch_video", { defaultValue: "Watch Video" })}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleGenerate(s)}
                    disabled={generate.isPending}
                    className="rounded-full"
                  >
                    {generate.isPending && generate.variables?.storyId === s.id ? (
                      <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                    ) : (
                      <Headphones className="h-4 w-4 me-1.5" />
                    )}
                    {t("my_stories.generate", { defaultValue: "Generate Narration" })}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <StoryVideoPlayer
          open={!!active}
          onClose={() => setActive(null)}
          audioUrl={active.story.audio_url ?? ""}
          pages={active.pages}
          pageWeights={active.weights}
          title={active.story.title ?? "Story"}
        />
      )}
    </div>
  );
};

export default MyAiStories;
