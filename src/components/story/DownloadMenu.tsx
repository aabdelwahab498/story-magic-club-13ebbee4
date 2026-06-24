import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  FileType,
  Headphones,
  BookOpen,
  Loader2,
  Lock,
  Images,
  Package,
  FileType2,
} from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import {
  downloadFromUrl,
  downloadTxt,
  downloadDocx,
  downloadAudioMp3,
  downloadImagesZip,
  downloadCompletePack,
  exportStoryPdf,
  exportStoryEpub,
  safeFilename,
  signStorageUrl,
  logDownload,
  fetchDownloadSettings,
  getTodayDownloadCount,
  isFormatEnabled,
  DEFAULT_DOWNLOAD_SETTINGS,
  type DownloadSettings,
  type StoryPageLike,
} from "@/lib/storyDownloads";

interface DownloadMenuProps {
  storyId: string;
  title: string;
  pages: StoryPageLike[];
  pdfUrl?: string | null;
  audioUrl?: string | null;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
}

type Fmt = "pdf" | "mp3" | "txt" | "docx" | "epub" | "images" | "pack";

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
  const { user } = useAuth();
  const [busy, setBusy] = useState<Fmt | null>(null);
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULT_DOWNLOAD_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    fetchDownloadSettings()
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch(() => {/* keep defaults */});
    return () => { cancelled = true; };
  }, []);

  const allowed = canExportPdf; // master gate for PDF/DOCX/EPUB
  const premium = canAudio; // gate for MP3/Images/Pack
  const filename = safeFilename(title);
  const hasImages = pages.some((p) => !!p.image_url);

  const handle = async (fmt: Fmt) => {
    if (!isFormatEnabled(settings, fmt)) {
      toast.error(
        t("downloads.format_disabled", {
          defaultValue: "This download format is currently disabled by the admin.",
        }),
      );
      return;
    }
    // Daily limit enforcement (admins/anon users skip)
    if (user?.id) {
      try {
        const used = await getTodayDownloadCount(user.id);
        if (used >= settings.daily_limit_per_user) {
          toast.error(
            t("downloads.daily_limit_reached", {
              defaultValue: "Daily download limit reached. Try again tomorrow.",
            }),
          );
          return;
        }
      } catch {/* non-blocking */}
    }
    if (fmt !== "txt") {
      const needsPdfGate = fmt === "pdf" || fmt === "docx" || fmt === "epub";
      const needsPremium = fmt === "mp3" || fmt === "images" || fmt === "pack";
      if (needsPdfGate && !allowed) {
        toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
        return;
      }
      if (needsPremium && !premium) {
        toast.error(
          t("downloads.premium_paywall", {
            defaultValue: "Premium plan required for this download.",
          }),
        );
        return;
      }
    }
    try {
      setBusy(fmt);
      if (fmt === "pdf") {
        let url = pdfUrl || null;
        if (!url) {
          toast.message(t("downloads.generating_pdf", { defaultValue: "Generating PDF…" }));
          url = await exportStoryPdf(storyId);
        }
        const signed = await signStorageUrl(url, "story-pdfs");
        await downloadFromUrl(signed, `najmah-${filename}.pdf`);
      } else if (fmt === "mp3") {
        if (!audioUrl) {
          toast.error(t("downloads.no_audio", { defaultValue: "Generate narration first." }));
          return;
        }
        await downloadAudioMp3(audioUrl, `najmah-${filename}.mp3`);
      } else if (fmt === "txt") {
        downloadTxt(title, pages);
      } else if (fmt === "docx") {
        toast.message(t("downloads.generating_docx", { defaultValue: "Building DOCX…" }));
        await downloadDocx(title, pages);
      } else if (fmt === "epub") {
        toast.message(t("downloads.generating_epub", { defaultValue: "Building EPUB…" }));
        const url = await exportStoryEpub(storyId);
        await downloadFromUrl(url, `najmah-${filename}.epub`);
      } else if (fmt === "images") {
        if (!hasImages) {
          toast.error(
            t("downloads.no_images", { defaultValue: "No illustrations available." }),
          );
          return;
        }
        toast.message(
          t("downloads.zipping_images", { defaultValue: "Bundling illustrations…" }),
        );
        const ok = await downloadImagesZip(title, pages);
        if (!ok) {
          toast.error(t("downloads.no_images", { defaultValue: "No illustrations available." }));
          return;
        }
      } else if (fmt === "pack") {
        toast.message(
          t("downloads.building_pack", {
            defaultValue: "Assembling Complete Story Pack…",
          }),
        );
        await downloadCompletePack({
          storyId,
          title,
          pages,
          pdfUrl,
          audioUrl,
        });
      }
      void logDownload({ storyId, storyTitle: title, format: fmt });
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {t("downloads.formats", { defaultValue: "Choose format" })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handle("pack")}
          disabled={busy !== null || !settings.enable_pack}
          className="font-semibold"
        >
          <Package className="h-4 w-4 me-2 text-primary" />
          {t("downloads.pack", { defaultValue: "Complete Story Pack" })}
          {(!premium || !settings.enable_pack) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handle("pdf")} disabled={busy !== null || !settings.enable_pdf}>
          <FileType className="h-4 w-4 me-2" />
          PDF
          {(!allowed || !settings.enable_pdf) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handle("mp3")}
          disabled={busy !== null || !audioUrl || !settings.enable_mp3}
        >
          <Headphones className="h-4 w-4 me-2" />
          MP3 {t("downloads.audio", { defaultValue: "Audio" })}
          {(!premium || !audioUrl || !settings.enable_mp3) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("docx")} disabled={busy !== null || !settings.enable_docx}>
          <FileType2 className="h-4 w-4 me-2" />
          DOCX
          {(!allowed || !settings.enable_docx) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("epub")} disabled={busy !== null || !settings.enable_epub}>
          <BookOpen className="h-4 w-4 me-2" />
          EPUB
          {(!allowed || !settings.enable_epub) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("txt")} disabled={busy !== null || !settings.enable_txt}>
          <FileText className="h-4 w-4 me-2" />
          TXT
          {!settings.enable_txt && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handle("images")}
          disabled={busy !== null || !hasImages || !settings.enable_images}
        >
          <Images className="h-4 w-4 me-2" />
          {t("downloads.images", { defaultValue: "Images (ZIP)" })}
          {(!premium || !hasImages || !settings.enable_images) && <Lock className="h-3 w-3 ms-auto opacity-60" />}
        </DropdownMenuItem>

        {(!allowed || !premium) && (
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
