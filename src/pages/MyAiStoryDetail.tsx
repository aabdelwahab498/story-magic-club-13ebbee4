import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Headphones, Play, Pause, ChevronLeft, ChevronRight, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Seo from "@/components/Seo";
import StoryVideoPlayer, { type StoryVideoPage } from "@/components/story/StoryVideoPlayer";
import DownloadMenu from "@/components/story/DownloadMenu";
import StoryPreviewDialog from "@/components/story/StoryPreviewDialog";
import { downloadAudioMp3, safeFilename } from "@/lib/storyDownloads";
import { toast } from "sonner";
import type { AiStoryRow } from "@/lib/aiStoryApi";

const splitTextIntoPages = (text: string): StoryVideoPage[] => {
  return text
    .split(/\n{2,}|(?<=[\.!\?])\s+(?=[A-Z\u0600-\u06FF])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .map((t) => ({ text: t, image_url: null }));
};

const pagesFromRow = (s: AiStoryRow): StoryVideoPage[] => {
  if (Array.isArray(s.pages) && s.pages.length > 0) {
    return s.pages
      .map((p) => ({
        text: String(p.text ?? (p as { content?: string }).content ?? "").trim(),
        image_url: p.image_url ?? null,
      }))
      .filter((p) => p.text.length > 0);
  }
  const txt = String((s.generated_story as { text?: string })?.text ?? "");
  return splitTextIntoPages(txt);
};

const MyAiStoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [pageIndex, setPageIndex] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);

  const { data: story, isLoading, error } = useQuery({
    queryKey: ["my_ai_story", id],
    enabled: !!id,
    queryFn: async (): Promise<AiStoryRow | null> => {
      const { data, error } = await supabase
        .from("ai_story_history")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as AiStoryRow) ?? null;
    },
  });

  const pages = useMemo(() => (story ? pagesFromRow(story) : []), [story]);
  const current = pages[pageIndex];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-muted-foreground">
          {t("story_detail.not_found", { defaultValue: "Story not found." })}
        </p>
        <Button asChild variant="outline">
          <Link to="/my-stories">
            <ArrowLeft className="h-4 w-4 me-2" />
            {t("story_detail.back", { defaultValue: "Back to my stories" })}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <Seo
        title={`${story.title || "Story"} — NajmaH`}
        description={t("story_detail.seo_desc", { defaultValue: "Read and listen to your AI story." })}
      />

      <header className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          {t("story_detail.back", { defaultValue: "Back" })}
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Badge variant="secondary">{story.language.toUpperCase()}</Badge>
          <span>{new Date(story.created_at).toLocaleDateString(i18n.language)}</span>
          <StoryPreviewDialog title={story.title ?? "Story"} pages={pages} />
          <DownloadMenu
            storyId={story.id}
            title={story.title ?? "Story"}
            pages={pages}
            pdfUrl={(story as unknown as { pdf_url?: string | null }).pdf_url ?? null}
            audioUrl={story.audio_url ?? null}
          />
        </div>
      </header>

      <Card className="p-5 sm:p-6 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {story.title || t("my_stories.untitled", { defaultValue: "Untitled story" })}
        </h1>

        {story.audio_url && (
          <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Headphones className="h-4 w-4" />
              {t("story_detail.audio", { defaultValue: "Audio" })}
            </div>
            <audio src={story.audio_url} controls preload="metadata" className="flex-1 min-w-[200px]" />
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={async () => {
                try {
                  await downloadAudioMp3(story.audio_url!, `${safeFilename(story.title ?? "story")}.mp3`);
                  toast.success(t("downloads.done", { defaultValue: "Download started" }));
                } catch {
                  toast.error(t("downloads.failed", { defaultValue: "Download failed" }));
                }
              }}
            >
              <Headphones className="h-4 w-4" />
              {t("story_detail.download_mp3", { defaultValue: "Download MP3" })}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setVideoOpen(true)} className="gap-1">
              <Film className="h-4 w-4" />
              {t("story_detail.watch_video", { defaultValue: "Watch as video" })}
            </Button>
          </div>
        )}

        {current?.image_url && (
          <img
            src={current.image_url}
            alt={`${story.title || "Story"} — page ${pageIndex + 1}`}
            className="w-full rounded-xl object-cover max-h-[420px]"
            loading="lazy"
          />
        )}

        {current && (
          <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
            {current.text}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("story_detail.prev", { defaultValue: "Previous" })}
          </Button>
          <span className="text-xs text-muted-foreground">
            {pageIndex + 1} / {pages.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            disabled={pageIndex >= pages.length - 1}
            className="gap-1"
          >
            {t("story_detail.next", { defaultValue: "Next" })}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {videoOpen && story.audio_url && (
        <StoryVideoPlayer
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          audioUrl={story.audio_url}
          pages={pages}
          title={story.title ?? "Story"}
        />
      )}
    </div>
  );
};

export default MyAiStoryDetail;
