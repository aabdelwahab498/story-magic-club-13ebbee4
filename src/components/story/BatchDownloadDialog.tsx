import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { batchDownloadStories } from "@/lib/storyDownloads";
import { Link } from "react-router-dom";

interface Props {
  childId?: string;
  triggerLabel?: string;
}

type Fmt = "pdf" | "mp3" | "txt" | "epub";

export default function BatchDownloadDialog({ childId, triggerLabel }: Props) {
  const { t } = useTranslation();
  const { canExportPdf } = useSubscription();
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<Record<Fmt, boolean>>({
    pdf: true, mp3: false, txt: true, epub: false,
  });
  const [busy, setBusy] = useState(false);

  const toggle = (f: Fmt) => setFormats((s) => ({ ...s, [f]: !s[f] }));

  const handleRun = async () => {
    const chosen = (Object.keys(formats) as Fmt[]).filter((f) => formats[f]);
    if (chosen.length === 0) {
      toast.error(t("batch.no_formats", { defaultValue: "Pick at least one format." }));
      return;
    }
    setBusy(true);
    try {
      toast.message(t("batch.building", { defaultValue: "Building bundle…" }));
      const res = await batchDownloadStories({ childId, formats: chosen });
      if (!res.bundleUrl) throw new Error("no_url");
      // Trigger download
      const a = document.createElement("a");
      a.href = res.bundleUrl;
      a.download = `stories-bundle-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(t("batch.done", { defaultValue: `Ready — ${res.total} stories bundled.` }));
      setOpen(false);
    } catch (e) {
      const msg = (e as Error)?.message ?? "error";
      if (msg.includes("subscription_required")) {
        toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
      } else if (msg.includes("no_stories")) {
        toast.error(t("batch.no_stories", { defaultValue: "No stories to bundle." }));
      } else {
        toast.error(t("batch.failed", { defaultValue: "Batch download failed" }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5 rounded-full">
          <Package className="h-4 w-4" />
          {triggerLabel ?? t("batch.trigger", { defaultValue: "Download all (ZIP)" })}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("batch.title", { defaultValue: "Download all stories" })}</DialogTitle>
          <DialogDescription>
            {t("batch.desc", {
              defaultValue: "Choose which file formats to include. Max 50 stories per bundle.",
            })}
          </DialogDescription>
        </DialogHeader>

        {!canExportPdf ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {t("batch.paywall", { defaultValue: "Batch download is a paid feature." })}{" "}
            <Link to="/pricing" className="text-primary font-semibold">
              {t("downloads.upgrade", { defaultValue: "Upgrade →" })}
            </Link>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {(["pdf", "mp3", "epub", "txt"] as Fmt[]).map((f) => (
              <label key={f} className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={formats[f]} onCheckedChange={() => toggle(f)} />
                <span className="text-sm font-medium uppercase">{f}</span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={handleRun} disabled={busy || !canExportPdf} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("batch.run", { defaultValue: "Build & Download" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
