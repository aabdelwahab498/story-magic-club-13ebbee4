import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Package, Download, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { startBatchDownload } from "@/lib/storyDownloads";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  childId?: string;
  triggerLabel?: string;
}

type Fmt = "pdf" | "mp3" | "txt" | "epub";

interface JobRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  bundle_url: string | null;
  error: string | null;
}

export default function BatchDownloadDialog({ childId, triggerLabel }: Props) {
  const { t } = useTranslation();
  const { canExportPdf } = useSubscription();
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<Record<Fmt, boolean>>({
    pdf: true, mp3: false, txt: true, epub: false,
  });
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobRow | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const toggle = (f: Fmt) => setFormats((s) => ({ ...s, [f]: !s[f] }));

  // Cleanup realtime channel
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // When job completes, auto-trigger download
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" && job.bundle_url) {
      const a = document.createElement("a");
      a.href = job.bundle_url;
      a.download = `stories-bundle-${job.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(t("batch.done", { defaultValue: `Ready — ${job.total} stories bundled.` }));
      setBusy(false);
    } else if (job.status === "failed") {
      toast.error(t("batch.failed", { defaultValue: "Batch download failed" }));
      setBusy(false);
    }
  }, [job?.status, job?.bundle_url, t]);

  const subscribe = (jobId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`batch-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "batch_export_jobs", filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as JobRow),
      )
      .subscribe();
    channelRef.current = ch;
  };

  // Safety net: poll every 4s if realtime is delayed
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("batch_export_jobs")
        .select("id,status,total,completed,bundle_url,error")
        .eq("id", job.id)
        .maybeSingle();
      if (data) setJob(data as JobRow);
    }, 4000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  const handleRun = async () => {
    const chosen = (Object.keys(formats) as Fmt[]).filter((f) => formats[f]);
    if (chosen.length === 0) {
      toast.error(t("batch.no_formats", { defaultValue: "Pick at least one format." }));
      return;
    }
    setBusy(true);
    setJob(null);
    try {
      toast.message(t("batch.queued", { defaultValue: "Starting bundle…" }));
      const res = await startBatchDownload({ childId, formats: chosen });
      subscribe(res.jobId);
      setJob({
        id: res.jobId,
        status: "running",
        total: res.total,
        completed: 0,
        bundle_url: null,
        error: null,
      });
    } catch (e) {
      const msg = (e as Error)?.message ?? "error";
      setBusy(false);
      if (msg.includes("subscription_required")) {
        toast.error(t("downloads.paywall", { defaultValue: "Upgrade to download stories." }));
      } else if (msg.includes("no_stories")) {
        toast.error(t("batch.no_stories", { defaultValue: "No stories to bundle." }));
      } else {
        toast.error(t("batch.failed", { defaultValue: "Batch download failed" }));
      }
    }
  };

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
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
            {t("batch.desc_v2", {
              defaultValue: "Choose which formats to include. Up to 100 stories per bundle. The signed link is valid for 1 hour.",
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
        ) : job ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {job.status === "completed" ? (
                  <span className="text-primary flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {t("batch.completed", { defaultValue: "Bundle ready" })}</span>
                ) : job.status === "failed" ? (
                  <span className="text-destructive flex items-center gap-1"><XCircle className="h-4 w-4" /> {t("batch.failed", { defaultValue: "Failed" })}</span>
                ) : (
                  <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> {t("batch.building", { defaultValue: "Bundling…" })}</span>
                )}
              </span>
              <span className="text-muted-foreground">{job.completed} / {job.total}</span>
            </div>
            <Progress value={pct} />
            {job.error && <p className="text-xs text-destructive">{job.error}</p>}
            {job.status === "completed" && job.bundle_url && (
              <Button asChild size="sm" className="w-full gap-1.5">
                <a href={job.bundle_url} download>
                  <Download className="h-4 w-4" />
                  {t("batch.download_again", { defaultValue: "Download ZIP again" })}
                </a>
              </Button>
            )}
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
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          {!job && (
            <Button onClick={handleRun} disabled={busy || !canExportPdf} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("batch.run", { defaultValue: "Build & Download" })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
