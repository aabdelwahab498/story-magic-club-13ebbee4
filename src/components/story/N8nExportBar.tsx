// ============================================================================
// N8nExportBar — Floating action bar with TXT / MP3 / PDF export buttons.
// ----------------------------------------------------------------------------
// The TXT button is wired to the n8n export pipeline. MP3 and PDF slots are
// present in the UI (disabled with a "coming soon" state) so the layout is
// stable when their workflows come online later.
// ============================================================================

import { useTranslation } from "react-i18next";
import { FileText, Volume2, BookOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useN8nExport } from "@/hooks/useN8nExport";
import type { SupportedLanguage } from "@/lib/n8nExportApi";

export interface N8nExportBarProps {
  /** Full story text (concatenated pages). */
  fullText: string;
  /** Story title used for filenames and headers. */
  title: string;
  /** Language code (ar/en/fr/de/es/pt). */
  language: SupportedLanguage | string;
  /** Optional story id when persisted. */
  storyId?: string | null;
  /** Optional active child id (for audit). */
  childId?: string | null;
  /** Optional child name for personalization. */
  childName?: string | null;
  /** Emotion tags (SEL) — used by n8n for future DAP scoring. */
  emotionTags?: string[];
  /** Total page count when known. */
  pageCount?: number;
  /** Extra tailwind classes for the outer container. */
  className?: string;
}

export default function N8nExportBar({
  fullText,
  title,
  language,
  storyId = null,
  childId = null,
  childName = null,
  emotionTags = [],
  pageCount,
  className,
}: N8nExportBarProps) {
  const { t } = useTranslation();
  const { status, error, exportTxt, prepareDownloadWindow, reset, isBusy } = useN8nExport();

  const handleTxt = () => {
    prepareDownloadWindow(); // synchronous — preserves the user gesture
    void exportTxt({
      storyId,
      childId,
      title,
      fullText,
      language,
      childName,
      emotionTags,
      pageCount,
    });
  };

  return (
    <div
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur-md sm:gap-3 sm:p-4",
        "max-w-2xl",
        className,
      )}
      role="toolbar"
      aria-label={t("exports.toolbar_label", "Story export toolbar")}
    >
      {/* TXT — live via n8n */}
      <Button
        type="button"
        onClick={handleTxt}
        disabled={isBusy || !fullText}
        className="gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 font-bold text-white shadow-md hover:shadow-lg disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4" aria-hidden="true" />
        )}
        <span>
          {isBusy
            ? t("exports.txt_preparing", "Preparing text...")
            : t("exports.txt_button", "Export text (TXT)")}
        </span>
      </Button>

      {/* MP3 — placeholder for the next n8n workflow */}
      <Button
        type="button"
        disabled
        title={t("exports.coming_soon", "Coming soon")}
        className="gap-2 rounded-full bg-muted px-5 py-2 font-bold text-muted-foreground disabled:opacity-70"
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        <span>{t("exports.mp3_button", "Export audio (MP3)")}</span>
        <span className="ms-1 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
          {t("exports.soon_pill", "SOON")}
        </span>
      </Button>

      {/* PDF — placeholder for the next n8n workflow */}
      <Button
        type="button"
        disabled
        title={t("exports.coming_soon", "Coming soon")}
        className="gap-2 rounded-full bg-muted px-5 py-2 font-bold text-muted-foreground disabled:opacity-70"
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        <span>{t("exports.pdf_button", "Export story (PDF)")}</span>
        <span className="ms-1 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
          {t("exports.soon_pill", "SOON")}
        </span>
      </Button>

      {/* Inline error + retry */}
      {status === "error" && error && (
        <div className="flex w-full items-center justify-center gap-2 text-sm text-destructive">
          <span>{error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              reset();
              handleTxt();
            }}
            className="gap-1 rounded-full"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("exports.retry", "Try again")}
          </Button>
        </div>
      )}
    </div>
  );
}
