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
  prepareDownloadTarget,
  exportStoryPdf,
  exportStoryEpub,
  safeFilename,
  signStorageUrl,
  logDownload,
  logDownloadAudit,
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
    const audit = (outcome: "success" | "rejected" | "error", reason?: string) =>
      void logDownloadAudit({ storyId, storyTitle: title, format: fmt, outcome, reason });

    if (!isFormatEnabled(settings, fmt)) {
      toast.error(
        t("downloads.format_disabled", {
          defaultValue: "This download format is currently disabled by the admin.",
        }),
      );
      audit("rejected", "format_disabled");
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
          audit("rejected", "daily_limit_reached");
          return;
        }
      } catch {/* non-blocking */}
    }
    if (fmt !== "txt") {
      const needsPdfGate = fmt === "pdf" || fmt === "docx" || fmt === "epub";
      const needsPremium = fmt === "mp3" || fmt === "images" || fmt === "pack";
      if (needsPdfGate && !allowed) {
        toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
        audit("rejected", "subscription_required_pdf");
        return;
      }
      if (needsPremium && !premium) {
        toast.error(
          t("downloads.premium_paywall", {
            defaultValue: "Premium plan required for this download.",
          }),
        );
        audit("rejected", "subscription_required_premium");
        return;
      }
    }
    let downloadTarget: ReturnType<typeof prepareDownloadTarget>;
    try {
      downloadTarget = prepareDownloadTarget();
      setBusy(fmt);
      if (fmt === "pdf") {
        let url = pdfUrl || null;
        if (!url) {
          toast.message(t("downloads.generating_pdf", { defaultValue: "Generating PDF…" }));
          url = await exportStoryPdf(storyId);
        }
        const signed = await signStorageUrl(url, "story-pdfs");
        await downloadFromUrl(signed, `najmah-${filename}.pdf`, downloadTarget);
      } else if (fmt === "mp3") {
        if (!audioUrl) {
          toast.error(t("downloads.no_audio", { defaultValue: "Generate narration first." }));
          audit("rejected", "no_audio");
          return;
        }
        await downloadAudioMp3(audioUrl, `najmah-${filename}.mp3`, downloadTarget);
      } else if (fmt === "txt") {
        downloadTxt(title, pages, downloadTarget);
      } else if (fmt === "docx") {
        toast.message(t("downloads.generating_docx", { defaultValue: "Building DOCX…" }));
        await downloadDocx(title, pages, downloadTarget);
      } else if (fmt === "epub") {
        toast.message(t("downloads.generating_epub", { defaultValue: "Building EPUB…" }));
        const url = await exportStoryEpub(storyId);
        await downloadFromUrl(url, `najmah-${filename}.epub`, downloadTarget);
      } else if (fmt === "images") {
        if (!hasImages) {
          toast.error(
            t("downloads.no_images", { defaultValue: "No illustrations available." }),
          );
          audit("rejected", "no_images");
          return;
        }
        toast.message(
          t("downloads.zipping_images", { defaultValue: "Bundling illustrations…" }),
        );
        const ok = await downloadImagesZip(title, pages, undefined, downloadTarget);
        if (!ok) {
          toast.error(t("downloads.no_images", { defaultValue: "No illustrations available." }));
          audit("rejected", "no_images");
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
          downloadTarget,
        });
      }
      void logDownload({ storyId, storyTitle: title, format: fmt });
      audit("success");
      toast.success(t("downloads.done", { defaultValue: "Download started" }));
    } catch (e) {
      try { downloadTarget?.close(); } catch { /* ignore */ }
      const msg = (e as Error)?.message ?? "error";
      audit("error", msg.slice(0, 200));
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
