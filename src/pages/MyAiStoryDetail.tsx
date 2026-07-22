import { useMemo, useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Headphones, ChevronLeft, ChevronRight, Film, Sparkles, ImagePlus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Seo from "@/components/Seo";
import StoryVideoPlayer, { type StoryVideoPage } from "@/components/story/StoryVideoPlayer";
import DownloadMenu from "@/components/story/DownloadMenu";
import DownloadNowButton from "@/components/story/DownloadNowButton";
import StoryPreviewDialog from "@/components/story/StoryPreviewDialog";
import { downloadAudioMp3, safeFilename } from "@/lib/storyDownloads";
import { toast } from "sonner";
import type { AiStoryRow } from "@/lib/aiStoryApi";
import { useIllustrations } from "@/hooks/useIllustrations";
import { useGenerateIllustrations, useRetryIllustrations, useRegeneratePageIllustration, useExportIllustratedStory } from "@/hooks/useGenerateIllustrations";
import { Download } from "lucide-react";

import { useStoryAudio, useGenerateAudio, useRetryAudio, useDeleteAudio } from "@/hooks/useStoryAudio";

const splitTextIntoPages = (text: string): StoryVideoPage[] => {
  return text
    .split(/\n{2,}|(?<=([.!?]))\s+(?=[A-Z\u0600-\u06FF])/)
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

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`najmah_reading_state_${id}`);
      if (saved) {
        setPageIndex(parseInt(saved, 10));
      } else {
        setPageIndex(0);
      }
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      localStorage.setItem(`najmah_reading_state_${id}`, pageIndex.toString());
    }
  }, [id, pageIndex]);

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

  const { data: illustrationJob } = useIllustrations(id!);
  const { mutate: generateIllustrations, isPending: isGenerating } = useGenerateIllustrations();
  const { mutate: retryIllustrations, isPending: isRetrying } = useRetryIllustrations();
  const { mutate: regeneratePage, isPending: isRegeneratingPage } = useRegeneratePageIllustration();
  const { mutate: exportIllustratedStory, isPending: isExporting } = useExportIllustratedStory();

  // Audio Narration Hooks
  const { data: audioJob } = useStoryAudio(id!);
  const { mutate: generateAudio, isPending: isGeneratingAudio } = useGenerateAudio();
  const { mutate: retryAudio, isPending: isRetryingAudio } = useRetryAudio();
  const { mutate: deleteAudio, isPending: isDeletingAudio } = useDeleteAudio();

  const pages = useMemo(() => (story ? pagesFromRow(story) : []), [story]);
  const current = pages[pageIndex];

  const illustrations = illustrationJob?.illustrations || [];
  const currentIllustration = illustrations.find((img) => img.pageNumber === pageIndex + 1);
  const currentImageUrl = (currentIllustration?.status === "COMPLETED" ? currentIllustration.imageUrl : null) || current?.image_url;
  
  const isCurrentlyGenerating = isGenerating || isRetrying || isRegeneratingPage || ["GENERATING", "PENDING", "PROCESSING"].includes(illustrationJob?.jobStatus || "");

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
  const handleExportPdf = () => {
    if (!story) return;
    exportIllustratedStory(story.id, {
      onSuccess: (data) => {
        if (data.status === "WAITING_FOR_ILLUSTRATIONS") {
          toast.info(t("story_detail.waiting_for_illustrations", { 
            defaultValue: `Generating illustrations... (${data.progress?.completed}/${data.progress?.total})` 
          }));
        } else if (data.download_url) {
          toast.success(t("story_detail.export_success", { defaultValue: "PDF exported successfully!" }));
          window.open(data.download_url, "_blank");
        }
      },
      onError: () => {
        toast.error(t("story_detail.export_error", { defaultValue: "Failed to export PDF." }));
      }
    });
  };

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
          <DownloadNowButton
            storyId={story.id}
            title={story.title ?? "Story"}
            pdfUrl={(story as unknown as { pdf_url?: string | null }).pdf_url ?? null}
          />
          <DownloadMenu
            storyId={story.id}
            title={story.title ?? "Story"}
            pages={pages}
            pdfUrl={(story as unknown as { pdf_url?: string | null }).pdf_url ?? null}
            audioUrl={audioJob?.audioUrl || story.audio_url || null}
          />
          {illustrations.length > 0 && (
            <Button size="sm" variant="default" onClick={handleExportPdf} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
              {t("story_detail.download_pdf_book", { defaultValue: "Download PDF Book" })}
            </Button>
          )}
        </div>
      </header>

      <Card className="p-5 sm:p-6 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {story.title || t("my_stories.untitled", { defaultValue: "Untitled story" })}
        </h1>

        {/* Narration Section */}
        {(() => {
          const effectiveAudioUrl = audioJob?.audioUrl || story.audio_url;
          const status = audioJob?.status || (story.audio_url ? "COMPLETED" : "NONE");

          if (status === "COMPLETED" && effectiveAudioUrl) {
            return (
              <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Headphones className="h-4 w-4" />
                  {t("story_detail.audio", { defaultValue: "Audio" })}
                </div>
                <audio src={effectiveAudioUrl} controls preload="metadata" className="flex-1 min-w-[200px]" />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={async () => {
                    try {
                      await downloadAudioMp3(effectiveAudioUrl, `${safeFilename(story.title ?? "story")}.mp3`);
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => id && deleteAudio(id)}
                  disabled={isDeletingAudio}
                >
                  {isDeletingAudio ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                  {t("story_detail.delete_audio", { defaultValue: "Delete" })}
                </Button>
              </div>
            );
          }

          if (status === "PENDING" || status === "PROCESSING") {
            return (
              <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-3 justify-between flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("story_detail.generating_audio", { defaultValue: "Generating narration..." })}
                </div>
              </div>
            );
          }

          if (status === "FAILED") {
            return (
              <div className="rounded-xl bg-destructive/10 p-3 flex items-center gap-3 justify-between flex-wrap border border-destructive/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <Headphones className="h-4 w-4" />
                  <span>{t("story_detail.audio_failed", { defaultValue: "Narration failed" })}</span>
                  {audioJob?.error && <span className="text-xs font-normal">({audioJob.error})</span>}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => id && retryAudio(id)}
                  disabled={isRetryingAudio}
                >
                  {isRetryingAudio ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <RefreshCw className="h-4 w-4 me-2" />}
                  {t("story_detail.retry_audio", { defaultValue: "Retry Narration" })}
                </Button>
              </div>
            );
          }

          // status === "NONE"
          return (
            <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Headphones className="h-4 w-4" />
                {t("story_detail.no_audio", { defaultValue: "No narration yet" })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => id && generateAudio(id)}
                disabled={isGeneratingAudio}
                className="gap-1 border-primary/20 hover:bg-primary/5 hover:text-primary"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                {t("story_detail.generate_audio_btn", { defaultValue: "Generate Narration" })}
              </Button>
            </div>
          );
        })()}

        {currentImageUrl ? (
          <div className="relative group rounded-xl overflow-hidden shadow-sm border bg-background/50">
            <img
              src={currentImageUrl}
              alt={`${story.title || "Story"} — page ${pageIndex + 1}`}
              className="w-full rounded-xl object-cover max-h-[420px]"
              loading="lazy"
            />
            
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                className="bg-background/80 backdrop-blur shadow-sm hover:bg-background/90"
                onClick={() => {
                  if (id) {
                    regeneratePage({ storyId: id, pageNumber: pageIndex + 1 }, {
                      onSuccess: () => toast.success(t("story_detail.generate_success", { defaultValue: "Regenerating illustration..." })),
                      onError: () => toast.error(t("story_detail.generate_error", { defaultValue: "Failed to regenerate illustration." }))
                    });
                  }
                }}
                disabled={isCurrentlyGenerating}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRegeneratingPage ? 'animate-spin' : ''}`} />
                {t("story_detail.regenerate_btn", { defaultValue: "Regenerate" })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-xl bg-muted flex flex-col items-center justify-center min-h-[250px] space-y-4 border-2 border-dashed border-muted-foreground/20">
            {isCurrentlyGenerating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {illustrationJob?.jobStatus === "PROCESSING" 
                    ? `Generating illustrations (${illustrationJob.completedPages}/${illustrationJob.totalPages})...` 
                    : t("story_detail.generating_illustrations", { defaultValue: "Generating illustration..." })}
                </span>
              </div>
            ) : (
              <>
                <ImagePlus className="h-10 w-10 text-muted-foreground/50" />
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      if (id) {
                        generateIllustrations(id, {
                          onSuccess: () => toast.success(t("story_detail.generate_success", { defaultValue: "Generation started!" })),
                          onError: () => toast.error(t("story_detail.generate_error", { defaultValue: "Failed to generate illustrations." }))
                        });
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4 me-2 text-primary" />
                    {t("story_detail.generate_btn", { defaultValue: "Generate Illustrations" })}
                  </Button>
                  
                  {illustrationJob?.failedPages ? (
                    <Button 
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (id) {
                          retryIllustrations(id, {
                            onSuccess: () => toast.success("Retrying failed illustrations..."),
                            onError: () => toast.error("Failed to start retry.")
                          });
                        }
                      }}
                    >
                      Retry {illustrationJob.failedPages} Failed
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {current && (
          <p className="text-lg sm:text-xl md:text-2xl leading-relaxed text-foreground whitespace-pre-wrap font-medium">
            {current.text}
          </p>
        )}

        <div className="w-full bg-secondary h-2 rounded-full mt-4 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-in-out" 
            style={{ width: `${((pageIndex + 1) / (pages.length || 1)) * 100}%` }} 
          />
        </div>

        {pageIndex === pages.length - 1 && pages.length > 0 && (
          <div className="text-center py-4 animate-in fade-in zoom-in duration-500">
            <h3 className="text-xl font-bold text-primary flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t("story_detail.completed", { defaultValue: "Story Completed!" })}
            </h3>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
            className="gap-1 rounded-full px-6"
          >
            <ChevronLeft className="h-5 w-5" />
            {t("story_detail.prev", { defaultValue: "Previous" })}
          </Button>
          <span className="text-sm font-semibold text-muted-foreground">
            {pageIndex + 1} / {pages.length}
          </span>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            disabled={pageIndex >= pages.length - 1}
            className="gap-1 rounded-full px-6 bg-primary/5 hover:bg-primary/10 border-primary/20"
          >
            {t("story_detail.next", { defaultValue: "Next" })}
            <ChevronRight className="h-5 w-5" />
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
