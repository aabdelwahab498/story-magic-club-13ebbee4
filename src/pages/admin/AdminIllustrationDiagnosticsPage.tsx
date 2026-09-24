import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { buildRecoveryKey, findRecoverablePages } from "@/lib/illustrationRecovery";

interface DiagnosticEvent {
  id: string;
  story_id: string;
  user_id: string | null;
  idempotency_key: string | null;
  event: string;
  page_index: number | null;
  status: string | null;
  error: string | null;
  latency_ms: number | null;
  source: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface IllustrationRow {
  story_id: string;
  page_index: number;
  image_url: string | null;
  status: string;
  updated_at: string;
}

const value = (details: Record<string, unknown>, key: string) => {
  const raw = details[key];
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "—";
};

export default function AdminIllustrationDiagnosticsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [illustrations, setIllustrations] = useState<IllustrationRow[]>([]);
  const [storyFilter, setStoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveringStory, setRecoveringStory] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let eventQuery = supabase
        .from("illustration_job_events")
        .select("id,story_id,user_id,idempotency_key,event,page_index,status,error,latency_ms,source,details,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      let illustrationQuery = supabase
        .from("generated_illustrations")
        .select("story_id,page_index,image_url,status,updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (storyFilter.trim()) {
        eventQuery = eventQuery.ilike("story_id", `%${storyFilter.trim()}%`);
        illustrationQuery = illustrationQuery.eq("story_id", storyFilter.trim());
      }
      const [eventResult, illustrationResult] = await Promise.all([eventQuery, illustrationQuery]);
      if (eventResult.error) throw eventResult.error;
      if (illustrationResult.error) throw illustrationResult.error;
      setEvents((eventResult.data ?? []) as DiagnosticEvent[]);
      setIllustrations((illustrationResult.data ?? []) as IllustrationRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin_illustration_diagnostics.load_failed", "Could not load diagnostics"));
    } finally {
      setLoading(false);
    }
  }, [storyFilter, t]);

  useEffect(() => { void load(); }, [load]);

  const batches = useMemo(() => {
    const grouped = new Map<string, DiagnosticEvent[]>();
    for (const event of events) {
      const key = `${event.story_id}:${event.idempotency_key ?? event.created_at}`;
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return Array.from(grouped.entries()).map(([key, batchEvents]) => {
      const storyId = batchEvents[0].story_id;
      const pages = illustrations.filter((row) => row.story_id === storyId);
      const recoverable = findRecoverablePages(pages);
      const completed = pages.filter((row) => row.status === "ready" && row.image_url).length;
      return { key, storyId, events: batchEvents, pages, recoverable, completed, newest: batchEvents[0].created_at };
    }).sort((a, b) => b.newest.localeCompare(a.newest));
  }, [events, illustrations]);

  const recover = async (storyId: string, recoverable: number[]) => {
    if (recoveringStory) return;
    setRecoveringStory(storyId);
    try {
      const { data, error } = await supabase.functions.invoke("illustrate-story", {
        body: {
          trigger: "user",
          triggerSource: "admin_diagnostics_recovery",
          mode: "admin_recovery",
          storyId,
          idempotencyKey: buildRecoveryKey(storyId, recoverable),
        },
      });
      if (error) throw error;
      const result = data as { illustrations?: Array<{ status: string }>; repairedPages?: number[] };
      const failed = (result.illustrations ?? []).filter((page) => page.status !== "ready").length;
      if (failed > 0) toast.error(t("admin_illustration_diagnostics.partial", "Recovery finished with failed pages"));
      else toast.success(t("admin_illustration_diagnostics.recovered", "Missing illustrations recovered"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin_illustration_diagnostics.recovery_failed", "Recovery failed"));
    } finally {
      setRecoveringStory(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("admin_illustration_diagnostics.title", "Illustration diagnostics")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin_illustration_diagnostics.subtitle", "Provider, page, storage, persistence, and credit results by batch")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ms-2">{t("admin_illustration_diagnostics.refresh", "Refresh")}</span>
        </Button>
      </div>

      <div className="flex max-w-xl items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="diagnostic-story">{t("admin_illustration_diagnostics.story", "Story ID")}</Label>
          <Input id="diagnostic-story" value={storyFilter} onChange={(event) => setStoryFilter(event.target.value)} placeholder="UUID" />
        </div>
        <Button onClick={load} disabled={loading}>{t("admin_illustration_diagnostics.search", "Search")}</Button>
      </div>

      {batches.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">{t("admin_illustration_diagnostics.empty", "No illustration batches found.")}</p>
      )}

      {batches.map((batch) => {
        const latestByPage = new Map<number, DiagnosticEvent[]>();
        for (const event of batch.events) {
          if (event.page_index === null) continue;
          latestByPage.set(event.page_index, [...(latestByPage.get(event.page_index) ?? []), event]);
        }
        return (
          <Card key={batch.key} data-testid="illustration-diagnostic-batch">
            <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <CardTitle className="break-all text-base">{batch.storyId}</CardTitle>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{batch.events[0].idempotency_key ?? "legacy batch"}</p>
                <p className="text-xs text-muted-foreground">{new Date(batch.newest).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={batch.recoverable.length ? "destructive" : "secondary"}>
                  {batch.completed}/{Math.max(5, batch.pages.length)} {t("admin_illustration_diagnostics.ready", "ready")}
                </Badge>
                <Button
                  size="sm"
                  disabled={recoveringStory !== null || batch.recoverable.length === 0}
                  onClick={() => recover(batch.storyId, batch.recoverable)}
                  data-testid={`recover-${batch.storyId}`}
                >
                  {recoveringStory === batch.storyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  <span className="ms-2">{t("admin_illustration_diagnostics.recover", "Recover missing/failed")}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                {Array.from({ length: 5 }, (_, offset) => offset + 1).map((pageIndex) => {
                  const page = batch.pages.find((row) => row.page_index === pageIndex);
                  const pageEvents = latestByPage.get(pageIndex) ?? [];
                  const provider = pageEvents.find((event) => event.event === "provider_response");
                  const storage = pageEvents.find((event) => event.event === "storage");
                  const persistence = pageEvents.find((event) => event.event === "persistence" && value(event.details, "table") === "generated_illustrations");
                  const ready = page?.status === "ready" && !!page.image_url;
                  return (
                    <div key={pageIndex} className="rounded-md border bg-card p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <strong>{t("admin_illustration_diagnostics.page", "Page")} {pageIndex}</strong>
                        {ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                      <div><span className="text-muted-foreground">Status:</span> {page?.status ?? "missing"}</div>
                      <div><span className="text-muted-foreground">Provider:</span> {provider ? `${value(provider.details, "provider")} / ${value(provider.details, "model")}` : "—"}</div>
                      <div className="break-all"><span className="text-muted-foreground">Storage:</span> {storage ? `${storage.status} · ${value(storage.details, "path")}` : "—"}</div>
                      <div><span className="text-muted-foreground">Persistence:</span> {persistence?.status ?? "—"}</div>
                      {(provider?.error || storage?.error || persistence?.error) && <p className="text-destructive break-words">{provider?.error ?? storage?.error ?? persistence?.error}</p>}
                    </div>
                  );
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-2">Time</th><th>Event</th><th>Page</th><th>Status</th><th>Details</th><th>Error</th></tr></thead>
                  <tbody>{batch.events.map((event) => (
                    <tr key={event.id} className="border-t align-top">
                      <td className="py-2 whitespace-nowrap">{new Date(event.created_at).toLocaleTimeString()}</td>
                      <td>{event.event}</td><td>{event.page_index ?? "—"}</td><td>{event.status ?? "—"}</td>
                      <td className="max-w-sm break-all font-mono">{Object.keys(event.details).length ? JSON.stringify(event.details) : "—"}</td>
                      <td className="max-w-xs break-words text-destructive">{event.error ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}