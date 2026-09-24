import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  downloadFromUrl,
  exportStoryPdf,
  prepareDownloadTarget,
  safeFilename,
  signStorageUrl,
  logDownload,
  logDownloadAudit,
} from "@/lib/storyDownloads";

interface DownloadNowButtonProps {
  storyId: string;
  title: string;
  pdfUrl?: string | null;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
}

/**
 * "نزّل الآن" — universal Download Now button shown on every story.
 * Gating happens on click:
 *   - Not logged in → redirect to /auth with return path.
 *   - Logged in but no PDF entitlement → redirect to /pricing.
 *   - Entitled → generate/fetch the PDF and download it to the device.
 */
export default function DownloadNowButton({
  storyId,
  title,
  pdfUrl,
  variant = "default",
  size = "sm",
  label,
  className,
}: DownloadNowButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { canExportPdf } = useSubscription();
  const [busy, setBusy] = useState(false);

  const filename = safeFilename(title || "story");

  const handleClick = async () => {
    // 1) Require login
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      toast.info(
        t("downloads.login_required", {
          defaultValue: "Please sign in to download the story.",
        }),
      );
      navigate(`/auth?redirect=${next}`);
      return;
    }

    // 2) Require paid entitlement
    if (!canExportPdf) {
      toast.info(
        t("downloads.paywall", {
          defaultValue: "Upgrade to download stories.",
        }),
      );
      navigate("/pricing");
      return;
    }

    // 3) Download PDF
    const target = prepareDownloadTarget();
    setBusy(true);
    try {
      // Always verify readiness and rebuild from the persisted illustrations;
      // an older cached URL may have been generated before images existed.
      void pdfUrl;
      toast.message(t("downloads.generating_pdf", { defaultValue: "Preparing illustrated PDF…" }));
      const url = await exportStoryPdf(storyId);
      const signed = await signStorageUrl(url, "story-pdfs");
      await downloadFromUrl(signed, `najmah-${filename}.pdf`, target);
      void logDownload({ storyId, storyTitle: title, format: "pdf" });
      void logDownloadAudit({
        storyId,
        storyTitle: title,
        format: "pdf",
        outcome: "success",
      });
      toast.success(
        t("downloads.done", { defaultValue: "Download started" }),
      );
    } catch (e) {
      try {
        target?.close();
      } catch {
        /* ignore */
      }
      const msg = (e as Error)?.message ?? "error";
      void logDownloadAudit({
        storyId,
        storyTitle: title,
        format: "pdf",
        outcome: "error",
        reason: msg.slice(0, 200),
      });
      if (msg.includes("subscription_required")) {
        toast.error(
          t("downloads.paywall", {
            defaultValue: "Upgrade to download stories.",
          }),
        );
        navigate("/pricing");
      } else {
        toast.error(msg.includes("illustrations_not_ready")
          ? t("downloads.illustrations_not_ready", { defaultValue: "The illustrated story is still preparing. Please try again shortly." })
          : t("downloads.failed", { defaultValue: "Download failed" }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={busy}
      className={`gap-1.5 rounded-full ${className ?? ""}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label ??
        t("downloads.download_now", { defaultValue: "نزّل الآن" })}
    </Button>
  );
}
