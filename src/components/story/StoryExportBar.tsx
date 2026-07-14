import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useStoryExport, type ExportKind } from "@/hooks/useStoryExport";
import { listVoicesForLanguage, type SupportedLanguage, type VoiceConfig } from "@/lib/storyExportApi";

export interface StoryExportBarProps {
  fullText: string;
  title: string;
  language: SupportedLanguage;
  storyId?: string | null;
  childId?: string | null;
  childName?: string | null;
  emotionTags?: string[];
  pageCount?: number;
  pages?: Array<{ pageNumber: number; text: string; illustrationUrl?: string | null; emotionTag?: string | null }>;
  className?: string;
}

const SPEED_OPTIONS: Array<{ value: 0.8 | 1.0 | 1.2; labelKey: string; fallback: string }> = [
  { value: 0.8, labelKey: "exports.speed_slow", fallback: "Slow (kid-friendly)" },
  { value: 1.0, labelKey: "exports.speed_normal", fallback: "Normal" },
  { value: 1.2, labelKey: "exports.speed_fast", fallback: "Fast" },
];

export default function StoryExportBar({
  fullText,
  title,
  language,
  storyId = null,
  childId = null,
  childName = null,
  emotionTags = [],
  pageCount,
  pages,
  className,
}: StoryExportBarProps) {
  const { t } = useTranslation();
  const { status, error, exportTxt, exportAudio, exportPdf, prepareDownloadWindow, reset, retry, isBusyKind, kinds } = useStoryExport();
  const [voices, setVoices] = useState<VoiceConfig[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>();
  const [speed, setSpeed] = useState<0.8 | 1.0 | 1.2>(1.0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listVoicesForLanguage(String(language));
      if (cancelled) return;
      setVoices(list);
      setSelectedVoiceId((prev) => prev ?? list.find((v) => v.isDefault)?.voiceId ?? list[0]?.voiceId);
    })();
    return () => { cancelled = true; };
  }, [language]);

  const activeVoice = useMemo(() => voices.find((v) => v.voiceId === selectedVoiceId), [voices, selectedVoiceId]);

  const handleTxt = () => {
    prepareDownloadWindow();
    void exportTxt({ storyId, childId, title, fullText, language, childName, emotionTags, pageCount });
  };

  const handleAudio = () => {
    prepareDownloadWindow();
    void exportAudio({ storyId, childId, title, fullText, language, voiceId: selectedVoiceId, speed, childName, emotionTags });
  };

  const handlePdf = () => {
    if (!pages?.length) return;
    prepareDownloadWindow();
    void exportPdf({ storyId, childId, title, language, childName, emotionTags, pages });
  };

  const renderBadge = (kind: ExportKind) => {
    const info = kinds[kind];
    if (info.lastErrorCode) {
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1 rounded-full px-2 py-0 text-[10px] font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {info.lastErrorCode}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">{info.lastError}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 rounded-full px-2 py-0 text-[10px] font-semibold">
        {info.lastProvider ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : null}
        {info.lastProvider ?? t("exports.badge_local", "local")}
      </Badge>
    );
  };

  const busyTxt = isBusyKind("txt");
  const busyMp3 = isBusyKind("mp3");
  const busyPdf = isBusyKind("pdf");
  const pdfDisabled = !pages?.length;

  return (
    <div
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex max-w-3xl flex-col items-stretch gap-3 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur-md sm:p-4",
        className,
      )}
      role="toolbar"
      aria-label={t("exports.toolbar_label", "Story export toolbar")}
    >
      <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
        <div className="flex flex-col items-center gap-1">
          <Button type="button" onClick={handleTxt} disabled={busyTxt || !fullText} className="gap-2 rounded-full px-5 py-2 font-bold shadow-md hover:shadow-lg disabled:opacity-60">
            {busyTxt ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span>{busyTxt ? t("exports.txt_preparing", "Preparing text...") : t("exports.txt_button", "Export text (TXT)")}</span>
          </Button>
          {renderBadge("txt")}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-stretch overflow-hidden rounded-full bg-primary shadow-md">
            <Button type="button" onClick={handleAudio} disabled={busyMp3 || !fullText} className="gap-2 rounded-none border-0 bg-transparent px-5 py-2 font-bold text-primary-foreground hover:bg-primary-foreground/10 disabled:opacity-60">
              {busyMp3 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              <span>{busyMp3 ? t("exports.mp3_preparing", "Recording...") : t("exports.mp3_button", "Export audio (MP3)")}</span>
            </Button>
            {voices.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" disabled={busyMp3} aria-label={t("exports.audio_settings", "Audio settings")} className="rounded-none border-0 border-s border-primary-foreground/20 bg-transparent px-3 py-2 text-primary-foreground hover:bg-primary-foreground/10 disabled:opacity-60">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{t("exports.voice", "Voice")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={selectedVoiceId ?? ""} onValueChange={(v) => setSelectedVoiceId(v)}>
                    {voices.map((v) => (
                      <DropdownMenuRadioItem key={v.voiceId} value={v.voiceId}>
                        <span className="flex-1 truncate">{v.displayName ?? v.voiceId}</span>
                        {v.sampleUrl && (
                          <a href={v.sampleUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ms-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-primary hover:bg-primary/10" aria-label={t("exports.play_sample", "Play sample")}>
                            <Play className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("exports.speed", "Speed")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={String(speed)} onValueChange={(v) => setSpeed(parseFloat(v) as 0.8 | 1.0 | 1.2)}>
                    {SPEED_OPTIONS.map((s) => <DropdownMenuRadioItem key={s.value} value={String(s.value)}>{t(s.labelKey, s.fallback)}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                  {activeVoice && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">{activeVoice.provider}</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {renderBadge("mp3")}
        </div>

        <div className="flex flex-col items-center gap-1">
          <Button type="button" onClick={handlePdf} disabled={busyPdf || pdfDisabled} title={pdfDisabled ? t("exports.pdf_needs_pages", "PDF requires structured pages") : undefined} className="gap-2 rounded-full px-5 py-2 font-bold shadow-md hover:shadow-lg disabled:opacity-60">
            {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            <span>{busyPdf ? t("exports.pdf_preparing", "Drawing your picture book...") : t("exports.pdf_button", "Export story (PDF)")}</span>
          </Button>
          {renderBadge("pdf")}
        </div>
      </div>

      {status === "error" && error && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={retry} className="gap-1 rounded-full">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("exports.retry", "Retry")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset} className="rounded-full">
            {t("exports.dismiss", "Dismiss")}
          </Button>
        </div>
      )}
    </div>
  );
}