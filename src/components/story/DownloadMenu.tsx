import { useState } from "react";
import { Download, FileText, FileType, Headphones, BookOpen, Loader2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubscription } from "@/hooks/useSubscription";
import {
  downloadFromUrl,
  downloadTxt,
  downloadAudioMp3,
  exportStoryPdf,
  exportStoryEpub,
  safeFilename,
  type StoryPageLike,
} from "@/lib/storyDownloads";
import StoryPreviewDialog from "@/components/story/StoryPreviewDialog";

interface DownloadMenuProps {
  storyId: string;
  title: string;
  pages: StoryPageLike[];
  pdfUrl?: string | null;
  audioUrl?: string | null;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
}

type Fmt = "pdf" | "mp3" | "txt" | "epub";

export default function DownloadMenu({
  storyId,
  title,
  pages,
  pdfUrl,
  audioUrl,
  variant = "outline",
  size = "sm",
}: DownloadMenuProps) {
  const { t } = useTranslation();
  const { canExportPdf, canAudio } = useSubscription();
  const [busy, setBusy] = useState<Fmt | null>(null);

  const allowed = canExportPdf; // master gate
  const filename = safeFilename(title);

  const handle = async (fmt: Fmt) => {
    if (!allowed && fmt !== "txt") {
      toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
      return;
    }
    try {
      setBusy(fmt);
      if (fmt === "pdf") {
        let url = pdfUrl || null;
        if (!url) {
          toast.message(t("downloads.generating_pdf", { defaultValue: "Generating PDF…" }));
          url = await exportStoryPdf(storyId);
        }
        await downloadFromUrl(url, `${filename}.pdf`);
      } else if (fmt === "mp3") {
        if (!canAudio) {
          toast.error(t("downloads.audio_paywall", { defaultValue: "Audio download needs a paid plan." }));
          return;
        }
        if (!audioUrl) {
          toast.error(t("downloads.no_audio", { defaultValue: "Generate narration first." }));
          return;
        }
        await downloadFromUrl(audioUrl, `${filename}.mp3`);
      } else if (fmt === "txt") {
        downloadTxt(title, pages);
      } else if (fmt === "epub") {
        toast.message(t("downloads.generating_epub", { defaultValue: "Building EPUB…" }));
        const url = await exportStoryEpub(storyId);
        await downloadFromUrl(url, `${filename}.epub`);
      }
      toast.success(t("downloads.done", { defaultValue: "Download started" }));
    } catch (e) {
      const msg = (e as Error)?.message ?? "error";
      if (msg.includes("subscription_required")) {
        toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
      } else {
        toast.error(t("downloads.failed", { defaultValue: "Download failed" }));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5 rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("downloads.menu", { defaultValue: "Download" })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("downloads.formats", { defaultValue: "Choose format" })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handle("pdf")} disabled={busy !== null}>
          <FileType className="h-4 w-4 me-2" />
          PDF
          {!allowed && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("mp3")} disabled={busy !== null || !audioUrl}>
          <Headphones className="h-4 w-4 me-2" />
          MP3 {t("downloads.audio", { defaultValue: "Audio" })}
          {(!canAudio || !audioUrl) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("epub")} disabled={busy !== null}>
          <BookOpen className="h-4 w-4 me-2" />
          EPUB
          {!allowed && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("txt")} disabled={busy !== null}>
          <FileText className="h-4 w-4 me-2" />
          TXT
        </DropdownMenuItem>
        {!allowed && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/pricing" className="text-primary font-semibold">
                {t("downloads.upgrade", { defaultValue: "Upgrade for downloads →" })}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
