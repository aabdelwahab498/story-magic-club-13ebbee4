import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Loader2, Package, Download, CheckCircle2, XCircle, Ban,
  RefreshCw, AlertTriangle, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  startBatchDownload,
  cancelBatchJob,
  refreshBundleUrl,
} from "@/lib/storyDownloads";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  childId?: string;
  triggerLabel?: string;
}

type Fmt = "pdf" | "mp3" | "txt" | "epub";

interface FailedItem {
  storyId: string;
  title: string;
  format: string;
  reason: string;
}

interface JobRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  bundle_url: string | null;
  error: string | null;
  failed_items: FailedItem[] | null;
  formats: string[];
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifiedRef = useRef<string | null>(null); // status we already toasted

  const toggle = (f: Fmt) => setFormats((s) => ({ ...s, [f]: !s[f] }));

  useEffect(() => () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  }, []);

  // Toast notifications + auto-download on terminal status change
  useEffect(() => {
    if (!job) return;
    const key = `${job.id}:${job.status}`;
    if (notifiedRef.current === key) return;

    if (job.status === "completed") {
      notifiedRef.current = key;
      if (job.bundle_url) {
        triggerDownload(job.bundle_url, `stories-bundle-${job.id.slice(0, 8)}.zip`);
      }
      const fails = job.failed_items?.length ?? 0;
      if (fails > 0) {
        toast.warning(
          t("batch.done_partial", {
            defaultValue: `Bundle ready — ${job.total - fails}/${job.total} stories included.`,
          }),
          { description: t("batch.failed_count", { defaultValue: `${fails} item(s) failed. You can retry just those.` }) },
        );
      } else {
        toast.success(t("batch.done", { defaultValue: `Bundle ready — ${job.total} stories.` }));
      }
      setBusy(false);
    } else if (job.status === "failed") {
      notifiedRef.current = key;
      toast.error(t("batch.failed", { defaultValue: "Batch download failed" }), {
        description: job.error ?? undefined,
      });
      setBusy(false);
    } else if (job.status === "cancelled") {
      notifiedRef.current = key;
      toast.message(t("batch.cancelled", { defaultValue: "Batch cancelled." }));
      setBusy(false);
    }
  }, [job, t]);

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

  // Polling safety net
  useEffect(() => {
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from("batch_export_jobs")
        .select("id,status,total,completed,bundle_url,error,failed_items,formats")
        .eq("id", job.id)
        .maybeSingle();
      if (data) setJob(data as unknown as JobRow);
    }, 4000);
    return () => clearInterval(id);
  }, [job]);

  const startJob = async (storyIds?: string[]) => {
    const chosen = (Object.keys(formats) as Fmt[]).filter((f) => formats[f]);
    if (chosen.length === 0) {
      toast.error(t("batch.no_formats", { defaultValue: "Pick at least one format." }));
      return;
    }
    setBusy(true);
    setJob(null);
    notifiedRef.current = null;
    try {
      toast.message(t("batch.queued", { defaultValue: "Starting bundle…" }));
      const res = await startBatchDownload({ childId, formats: chosen, storyIds });
      subscribe(res.jobId);
      setJob({
        id: res.jobId, status: "running",
        total: res.total, completed: 0,
        bundle_url: null, error: null, failed_items: [], formats: chosen,
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

  const handleCancel = async () => {
    if (!job) return;
    setCancelling(true);
    try {
      await cancelBatchJob(job.id);
      toast.message(t("batch.cancel_requested", { defaultValue: "Cancellation requested…" }));
    } catch {
      toast.error(t("batch.cancel_failed", { defaultValue: "Could not cancel" }));
    } finally {
      setCancelling(false);
    }
  };

  const handleRefresh = async () => {
    if (!job) return;
    setRefreshing(true);
    try {
      const url = await refreshBundleUrl(job.id);
      setJob({ ...job, bundle_url: url });
      triggerDownload(url, `stories-bundle-${job.id.slice(0, 8)}.zip`);
      toast.success(t("batch.url_refreshed", { defaultValue: "Fresh link generated." }));
    } catch {
      toast.error(t("batch.refresh_failed", { defaultValue: "Could not refresh link" }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!job?.failed_items) return;
    const uniqueIds = Array.from(new Set(job.failed_items.map((f) => f.storyId)));
    if (uniqueIds.length === 0) return;
    await startJob(uniqueIds);
  };

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : 0;
  const failedCount = job?.failed_items?.length ?? 0;
  const isRunning = job?.status === "running" || job?.status === "pending";
  const isTerminal = job && ["completed", "failed", "cancelled"].includes(job.status);

  const failedByStory = useMemo(() => {
    const map = new Map<string, FailedItem[]>();
    (job?.failed_items ?? []).forEach((f) => {
      const arr = map.get(f.storyId) ?? [];
      arr.push(f);
      map.set(f.storyId, arr);
    });
    return Array.from(map.entries());
  }, [job?.failed_items]);

  const reset = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setJob(null);
    notifiedRef.current = null;
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy || isTerminal) setOpen(o); }}>
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
              defaultValue: "Up to 100 stories per bundle. Signed link valid for 1 hour. You can cancel while running.",
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
                {job.status === "completed" && (
                  <span className="text-primary flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {t("batch.completed", { defaultValue: "Bundle ready" })}
                  </span>
                )}
                {job.status === "failed" && (
                  <span className="text-destructive flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> {t("batch.failed", { defaultValue: "Failed" })}
                  </span>
                )}
                {job.status === "cancelled" && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Ban className="h-4 w-4" /> {t("batch.cancelled", { defaultValue: "Cancelled" })}
                  </span>
                )}
                {isRunning && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("batch.building", { defaultValue: "Bundling…" })}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">{job.completed} / {job.total}</span>
            </div>

            <Progress value={pct} />

            {job.error && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {job.error}
              </p>
            )}

            {failedCount > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("batch.failed_header", { defaultValue: `${failedCount} item(s) failed` })}
                </p>
                <ScrollArea className="max-h-32">
                  <ul className="space-y-1 text-xs">
                    {failedByStory.map(([storyId, items]) => (
                      <li key={storyId} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{items[0].title}</span>
                        {" — "}
                        {items.map((i) => `${i.format}: ${i.reason}`).join("; ")}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {job.status === "completed" && (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm" className="w-full gap-1.5"
                  disabled={refreshing}
                  onClick={handleRefresh}
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("batch.redownload", { defaultValue: "Re-download ZIP (fresh link)" })}
                </Button>
                {failedCount > 0 && (
                  <Button
                    size="sm" variant="outline" className="w-full gap-1.5"
                    disabled={busy}
                    onClick={handleRetryFailed}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("batch.retry_failed", { defaultValue: "Retry failed items only" })}
                  </Button>
                )}
              </div>
            )}

            {(job.status === "failed" || job.status === "cancelled") && (
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                {t("batch.start_over", { defaultValue: "Start over" })}
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

        <DialogFooter className="gap-2">
          {isRunning && (
            <Button
              variant="destructive" size="sm" className="gap-1.5"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {t("batch.cancel", { defaultValue: "Cancel job" })}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy && !isTerminal}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          {!job && (
            <Button onClick={() => startJob()} disabled={busy || !canExportPdf} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("batch.run", { defaultValue: "Build & Download" })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
