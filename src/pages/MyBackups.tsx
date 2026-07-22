// /my-backups — user-facing page listing daily backups (last 30d retention)
// with download (5-minute signed URL) and restore-stories actions.
import { useEffect, useMemo, useState, useCallback } from "react";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Download, RotateCcw, Trash2, Shield, Clock, AlertCircle, CheckCircle2, RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchUserBackups,
  deleteUserBackup,
  downloadBackupJson,
  restoreStoriesFromBackup,
  formatBytes,
  fetchBackupJobsStatus,
  retryBackupForUser,
  type UserBackup,
  type BackupJobStatus,
} from "@/lib/userBackups";


export default function MyBackups() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, BackupJobStatus>>({});
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [b, j] = await Promise.all([fetchUserBackups(user.id), fetchBackupJobsStatus().catch(() => ({}))]);
      setRows(b);
      setJobs(j);
    } catch (e) {
      toast.error(`Failed to load backups: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalSize = useMemo(() => rows.reduce((a, r) => a + (r.size_bytes ?? 0), 0), [rows]);
  const completed = rows.filter((r) => r.status === "completed").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  const handleRetry = async (b?: UserBackup) => {
    if (!user) return;
    setRetrying(true);
    if (b) setBusyId(b.id);
    try {
      const r = await retryBackupForUser(user.id);
      toast.success(r.ok > 0 ? "Backup created successfully" : `Retry finished (${r.failed} failed)`);
      await load();
    } catch (e) {
      toast.error(`Retry failed: ${(e as Error).message}`);
    } finally {
      setRetrying(false);
      setBusyId(null);
    }
  };


  const handleDownload = async (b: UserBackup) => {
    setBusyId(b.id);
    try {
      await downloadBackupJson(b);
      toast.success("Backup download started");
    } catch (e) {
      toast.error(`Download failed: ${(e as Error).message}`);
    } finally { setBusyId(null); }
  };

  const handleRestore = async (b: UserBackup) => {
    if (!confirm("Restore stories from this backup? Existing stories with the same ID will be kept.")) return;
    setBusyId(b.id);
    try {
      const r = await restoreStoriesFromBackup(b);
      toast.success(`Restored ${r.restored} of ${r.total} stories (${r.skipped} already present)`);
    } catch (e) {
      toast.error(`Restore failed: ${(e as Error).message}`);
    } finally { setBusyId(null); }
  };

  const handleDelete = async (b: UserBackup) => {
    if (!confirm("Delete this backup permanently?")) return;
    setBusyId(b.id);
    try {
      await deleteUserBackup(b.id);
      setRows((cur) => cur.filter((r) => r.id !== b.id));
      toast.success("Backup deleted");
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally { setBusyId(null); }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 pb-24 md:pb-8">
      <Seo title="My Backups — Najmah" description="Daily backups of your AI stories with restore and download options." />


      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> My Backups
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily snapshots of your stories. Kept for 30 days. Download or restore at any time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={() => handleRetry()} disabled={retrying || loading}>
            {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            Run backup now
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Job status */}
      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-base">Backup jobs</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
          {(["run-user-backups", "cleanup-old-backups"] as const).map((name) => {
            const j = jobs[name];
            return (
              <div key={name} className="rounded-lg border p-3">
                <div className="font-medium">{name === "run-user-backups" ? "Daily backup creation" : "Old backup cleanup"}</div>
                <div className="text-xs text-muted-foreground mt-1">Scheduled: {name === "run-user-backups" ? "03:00 UTC daily" : "04:00 UTC daily"}</div>
                <div className="text-xs mt-1">
                  Last run: <span className="font-mono">{j?.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : "—"}</span>
                </div>
                {j?.lastStatus && (
                  <Badge variant={j.lastStatus === "completed" ? "secondary" : j.lastStatus === "failed" ? "destructive" : "outline"} className="mt-2">
                    {j.lastStatus}
                  </Badge>
                )}
                {j?.detail && <div className="text-xs text-muted-foreground mt-1 truncate">{j.detail}</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total backups</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-bold text-emerald-600">{completed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Failed</div><div className="text-2xl font-bold text-destructive">{failed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Storage used</div><div className="text-2xl font-bold">{formatBytes(totalSize)}</div></CardContent></Card>
      </div>

      <Alert className="mb-4">
        <Clock className="h-4 w-4" />
        <AlertTitle>Retention policy</AlertTitle>
        <AlertDescription>
          Backups are automatically deleted 30 days after creation. Per-user storage cap: 500 MB.
          Download links are signed and expire after 5 minutes.
        </AlertDescription>
      </Alert>


      <Card>
        <CardHeader><CardTitle>Available backups</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No backups yet. Your first daily backup will appear within 24 hours.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium flex items-center gap-2">
                      {b.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                      {b.backup_date}
                      <Badge variant={b.status === "completed" ? "secondary" : "destructive"}>{b.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.story_count} stories · {formatBytes(b.size_bytes)} · expires {new Date(b.expires_at).toLocaleDateString()}
                    </div>
                    {b.error_message && (
                      <div className="text-xs text-destructive mt-1">Error: {b.error_message}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {b.status === "failed" && (
                      <Button size="sm" variant="default" disabled={busyId === b.id || retrying} onClick={() => handleRetry(b)}>
                        {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                        Retry
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busyId === b.id || b.status !== "completed"} onClick={() => handleDownload(b)}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === b.id || b.status !== "completed"} onClick={() => handleRestore(b)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restore
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === b.id} onClick={() => handleDelete(b)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
