// ============================================================================
// N8nExportBar — Floating action bar with live TXT / MP3 / PDF export buttons.
// ----------------------------------------------------------------------------
// • TXT   → instant, n8n or local BOM-safe fallback
// • MP3   → cache-first via SHA-256; n8n TTS pipeline or in-house Edge-TTS
//           fallback. Voice picker + speed picker exposed inline.
// • PDF   → n8n picture-book workflow, falls back to the existing
//           export-story-pdf edge function.
// Independent loading states per button; shared error surface with retry.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText, Volume2, BookOpen, Loader2, RefreshCw, ChevronDown, Play,
  CheckCircle2, AlertTriangle, Cloud, HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useN8nExport, type ExportKind } from "@/hooks/useN8nExport";
import {
  listVoicesForLanguage,
  getN8nIntegrationStatus,
  type SupportedLanguage,
  type VoiceConfig,
  type N8nIntegrationStatus,
} from "@/lib/n8nExportApi";

export interface N8nExportBarProps {
  fullText: string;
  title: string;
  language: SupportedLanguage | string;
  storyId?: string | null;
  childId?: string | null;
  childName?: string | null;
  emotionTags?: string[];
  pageCount?: number;
  /** Optional structured pages — enables the PDF button when provided. */
  pages?: Array<{ pageNumber: number; text: string; illustrationUrl?: string | null; emotionTag?: string | null }>;
  className?: string;
}

const SPEED_OPTIONS: Array<{ value: 0.8 | 1.0 | 1.2; labelKey: string; fallback: string }> = [
  { value: 0.8, labelKey: "exports.speed_slow",   fallback: "Slow (kid-friendly)" },
  { value: 1.0, labelKey: "exports.speed_normal", fallback: "Normal" },
  { value: 1.2, labelKey: "exports.speed_fast",   fallback: "Fast" },
];

export default function N8nExportBar({
  fullText, title, language, storyId = null, childId = null,
  childName = null, emotionTags = [], pageCount, pages, className,
}: N8nExportBarProps) {
  const { t } = useTranslation();
  const {
    status, error, exportTxt, exportAudio, exportPdf,
    prepareDownloadWindow, reset, isBusyKind, kinds,
  } = useN8nExport();

  // ── Live integration status (used to render the "n8n / local" badge) ──
  const [integration, setIntegration] = useState<N8nIntegrationStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await getN8nIntegrationStatus();
      if (!cancelled) setIntegration(s);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Voice + speed state (audio button) ─────────────────────────────
  const [voices, setVoices] = useState<VoiceConfig[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>();
  const [speed, setSpeed] = useState<0.8 | 1.0 | 1.2>(1.0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listVoicesForLanguage(language);
      if (cancelled) return;
      setVoices(list);
      setSelectedVoiceId((prev) => prev ?? list.find((v) => v.isDefault)?.voiceId ?? list[0]?.voiceId);
    })();
    return () => { cancelled = true; };
  }, [language]);

  const activeVoice = useMemo(
    () => voices.find((v) => v.voiceId === selectedVoiceId),
    [voices, selectedVoiceId],
  );

  const handleTxt = () => {
    prepareDownloadWindow();
    void exportTxt({ storyId, childId, title, fullText, language, childName, emotionTags, pageCount });
  };

  const handleAudio = () => {
    prepareDownloadWindow();
    void exportAudio({
      storyId, childId, title, fullText, language,
      voiceId: selectedVoiceId, speed, childName, emotionTags,
    });
  };

  const handlePdf = () => {
    if (!pages?.length) return;
    prepareDownloadWindow();
    void exportPdf({
      storyId, childId, title, language, childName,
      emotionTags,
      pages,
    });
  };

  const busyTxt = isBusyKind("txt");
  const busyMp3 = isBusyKind("mp3");
  const busyPdf = isBusyKind("pdf");
  const pdfDisabled = !pages?.length;

  /**
   * Compact badge under each button:
   *  • last error (destructive) takes priority
   *  • otherwise "n8n" if this workflow will use n8n, else "local"
   *  • successful run adds a subtle checkmark
   */
  const renderBadge = (kind: ExportKind) => {
    const info = kinds[kind];
    const wf = integration?.workflows[kind];
    const usingN8n = wf?.using_n8n ?? false;
    const notConfigured = integration && !wf?.configured;
    const disabled = integration && wf && !wf.enabled;

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

    const label = usingN8n
      ? t("exports.badge_n8n", "n8n")
      : disabled
        ? t("exports.badge_disabled", "local (off)")
        : notConfigured
          ? t("exports.badge_not_configured", "local (not set)")
          : t("exports.badge_local", "local");

    const tip = usingN8n
      ? t("exports.badge_n8n_desc", "Using the n8n workflow.")
      : disabled
        ? t("exports.badge_disabled_desc", "n8n is turned off for this workflow — using the built-in fallback.")
        : notConfigured
          ? t("exports.badge_not_configured_desc", "n8n webhook not configured — using the built-in fallback.")
          : t("exports.badge_local_desc", "Using the built-in fallback.");

    const usedFallback = info.lastProvider && info.lastUsedFallback;
    const usedN8n = info.lastProvider && !info.lastUsedFallback;

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 rounded-full px-2 py-0 text-[10px] font-semibold border",
                usingN8n
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
              )}
            >
              {usingN8n ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
              <span>{label}</span>
              {info.lastProvider && (
                <CheckCircle2
                  className={cn(
                    "h-3 w-3",
                    usedN8n ? "text-emerald-500" : "text-amber-500",
                  )}
                />
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
            <div>{tip}</div>
            {info.lastProvider && (
              <div className="mt-1 text-muted-foreground">
                {t("exports.badge_last_run", "Last run:")}{" "}
                <span className="font-semibold">{info.lastProvider}</span>
                {usedFallback && ` — ${t("exports.badge_used_fallback", "fallback")}`}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex flex-col items-stretch gap-3 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur-md sm:p-4",
        "max-w-3xl",
        className,
      )}
      role="toolbar"
      aria-label={t("exports.toolbar_label", "Story export toolbar")}
    >
      <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
        {/* ─────────── TXT ─────────── */}
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            onClick={handleTxt}
            disabled={busyTxt || !fullText}
            className="gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 font-bold text-white shadow-md hover:shadow-lg disabled:opacity-60"
          >
            {busyTxt ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span>{busyTxt
              ? t("exports.txt_preparing", "Preparing text...")
              : t("exports.txt_button", "Export text (TXT)")}
            </span>
          </Button>
          {renderBadge("txt")}
        </div>

        {/* ─────────── MP3 ─────────── */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-stretch overflow-hidden rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-md">
            <Button
              type="button"
              onClick={handleAudio}
              disabled={busyMp3 || !fullText}
              className="gap-2 rounded-none border-0 bg-transparent px-5 py-2 font-bold text-white hover:bg-white/10 disabled:opacity-60"
            >
              {busyMp3 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              <span>{busyMp3
                ? t("exports.mp3_preparing", "Recording...")
                : t("exports.mp3_button", "Export audio (MP3)")}
              </span>
            </Button>
            {voices.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={busyMp3}
                    aria-label={t("exports.audio_settings", "Audio settings")}
                    className="rounded-none border-0 border-s border-white/20 bg-transparent px-3 py-2 text-white hover:bg-white/10 disabled:opacity-60"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{t("exports.voice", "Voice")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedVoiceId ?? ""}
                    onValueChange={(v) => setSelectedVoiceId(v)}
                  >
                    {voices.map((v) => (
                      <DropdownMenuRadioItem key={v.voiceId} value={v.voiceId}>
                        <span className="flex-1 truncate">{v.displayName ?? v.voiceId}</span>
                        {v.sampleUrl && (
                          <a
                            href={v.sampleUrl} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ms-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-primary hover:bg-primary/10"
                            aria-label={t("exports.play_sample", "Play sample")}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("exports.speed", "Speed")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={String(speed)}
                    onValueChange={(v) => setSpeed(parseFloat(v) as 0.8 | 1.0 | 1.2)}
                  >
                    {SPEED_OPTIONS.map((s) => (
                      <DropdownMenuRadioItem key={s.value} value={String(s.value)}>
                        {t(s.labelKey, s.fallback)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  {activeVoice && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                        {activeVoice.provider}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {renderBadge("mp3")}
        </div>

        {/* ─────────── PDF ─────────── */}
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            onClick={handlePdf}
            disabled={busyPdf || pdfDisabled}
            title={pdfDisabled ? t("exports.pdf_needs_pages", "PDF requires structured pages") : undefined}
            className="gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 font-bold text-white shadow-md hover:shadow-lg disabled:opacity-60"
          >
            {busyPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            <span>{busyPdf
              ? t("exports.pdf_preparing", "Drawing your picture book...")
              : t("exports.pdf_button", "Export story (PDF)")}
            </span>
          </Button>
          {renderBadge("pdf")}
        </div>
      </div>

      {/* Inline error + retry */}
      {status === "error" && error && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
          <Button
            type="button" size="sm" variant="outline"
            onClick={reset}
            className="gap-1 rounded-full"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("exports.dismiss", "Dismiss")}
          </Button>
        </div>
      )}
    </div>
  );
}
