/**
 * Admin → Illustration Analytics
 *
 * Visualises rows from `illustration_job_events` so an operator can answer
 * questions like:
 *
 *   - "How many failures did we get in the last 24h?"
 *   - "Which story is generating the most idempotent replays (likely a
 *      retry loop in the UI)?"
 *   - "What's the success vs. failure trend per day?"
 *
 * The chart is grouped by hour/day depending on the filter range and uses
 * the same event names emitted by the client metrics module
 * (`recordIllustrationMetric`) and the server `logLifecycle` helper:
 *
 *   queued | generating | complete | failed | idempotent_replay |
 *   idempotent_join | trigger_rejected
 *
 * Filters: time range, storyId substring, idempotencyKey substring.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type LifecycleEvent =
  | "queued"
  | "generating"
  | "complete"
  | "failed"
  | "idempotent_replay"
  | "idempotent_join"
  | "trigger_rejected";

interface EventRow {
  id: string;
  event: LifecycleEvent;
  story_id: string;
  idempotency_key: string | null;
  page_index: number | null;
  status: string | null;
  error: string | null;
  latency_ms: number | null;
  source: string | null;
  created_at: string;
}

const EVENT_COLORS: Record<LifecycleEvent, string> = {
  queued: "hsl(var(--muted-foreground))",
  generating: "hsl(var(--primary))",
  complete: "hsl(142 71% 45%)",
  failed: "hsl(var(--destructive))",
  idempotent_replay: "hsl(45 93% 47%)",
  idempotent_join: "hsl(28 95% 55%)",
  trigger_rejected: "hsl(280 70% 55%)",
};

const RANGE_OPTIONS = [
  { value: "1h", label: "Last 1 hour", ms: 60 * 60 * 1000, bucket: "minute" as const },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000, bucket: "hour" as const },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000, bucket: "day" as const },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000, bucket: "day" as const },
];

const truncate = (s: string, n = 12) => (s.length > n ? `${s.slice(0, n)}…` : s);

const bucketKey = (iso: string, bucket: "minute" | "hour" | "day"): string => {
  const d = new Date(iso);
  if (bucket === "minute") {
    d.setSeconds(0, 0);
  } else if (bucket === "hour") {
    d.setMinutes(0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
};

const bucketLabel = (iso: string, bucket: "minute" | "hour" | "day"): string => {
  const d = new Date(iso);
  if (bucket === "day") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

interface AuditRow {
  id: string;
  admin_user_id: string;
  viewed_at: string;
  filter_story_id: string | null;
  filter_idempotency_key: string | null;
  filter_range: string | null;
  user_agent: string | null;
}

const AUDIT_PAGE_SIZE = 25;

export default function AdminIllustrationAnalyticsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState("24h");
  const [storyFilter, setStoryFilter] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotal, setAuditTotal] = useState<number | null>(null);
  // Audit panel filters (server-enforced through Supabase + RLS)
  const [auditAdminFilter, setAuditAdminFilter] = useState("");
  const [auditUaFilter, setAuditUaFilter] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  const rangeMeta = RANGE_OPTIONS.find((r) => r.value === range) ?? RANGE_OPTIONS[1];

  const loadAudit = async (pageOverride?: number) => {
    const page = pageOverride ?? auditPage;
    setAuditLoading(true);
    try {
      const from = page * AUDIT_PAGE_SIZE;
      const to = from + AUDIT_PAGE_SIZE - 1;
      let q = supabase
        .from("illustration_analytics_audit")
        .select(
          "id, admin_user_id, viewed_at, filter_story_id, filter_idempotency_key, filter_range, user_agent",
          { count: "exact" },
        )
        .order("viewed_at", { ascending: false });
      if (auditAdminFilter.trim())
        q = q.ilike("admin_user_id", `%${auditAdminFilter.trim()}%`);
      if (auditUaFilter.trim()) q = q.ilike("user_agent", `%${auditUaFilter.trim()}%`);
      if (auditFrom) q = q.gte("viewed_at", new Date(auditFrom).toISOString());
      if (auditTo) q = q.lte("viewed_at", new Date(auditTo).toISOString());
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      setAuditRows((data ?? []) as AuditRow[]);
      setAuditTotal(count ?? null);
      if (pageOverride !== undefined) setAuditPage(page);
    } catch (e) {
      console.error("audit load failed", e);
    } finally {
      setAuditLoading(false);
    }
  };

  const recordAudit = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      await supabase.from("illustration_analytics_audit").insert({
        admin_user_id: uid,
        filter_story_id: storyFilter.trim() || null,
        filter_idempotency_key: keyFilter.trim() || null,
        filter_range: range,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      });
    } catch (e) {
      // Non-fatal: audit log should never block analytics use.
      console.warn("audit insert failed", e);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - rangeMeta.ms).toISOString();
      let q = supabase
        .from("illustration_job_events")
        .select(
          "id, event, story_id, idempotency_key, page_index, status, error, latency_ms, source, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (storyFilter.trim()) q = q.ilike("story_id", `%${storyFilter.trim()}%`);
      if (keyFilter.trim()) q = q.ilike("idempotency_key", `%${keyFilter.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as EventRow[]);
      void recordAudit();
      void loadAudit();
    } catch (e) {
      console.error(e);
      toast.error(
        t(
          "admin_illustration_analytics.load_failed",
          "Failed to load illustration events",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Bucket rows by time + event for the stacked-bar chart.
  const chartData = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const key = bucketKey(r.created_at, rangeMeta.bucket);
      const entry = map.get(key) ?? {
        bucket: key,
        label: bucketLabel(key, rangeMeta.bucket),
      };
      entry[r.event] = ((entry[r.event] as number) ?? 0) + 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.bucket).localeCompare(String(b.bucket)),
    );
  }, [rows, rangeMeta.bucket]);

  // Per-event totals.
  const totals = useMemo(() => {
    const t: Partial<Record<LifecycleEvent, number>> = {};
    for (const r of rows) t[r.event] = (t[r.event] ?? 0) + 1;
    return t;
  }, [rows]);

  // Per-story breakdown.
  const byStory = useMemo(() => {
    const map = new Map<string, Partial<Record<LifecycleEvent, number>>>();
    for (const r of rows) {
      const s = map.get(r.story_id) ?? {};
      s[r.event] = (s[r.event] ?? 0) + 1;
      map.set(r.story_id, s);
    }
    return Array.from(map.entries())
      .map(([story, counts]) => ({ story, ...counts }))
      .sort((a, b) => {
        const an = (a.failed ?? 0) + (a.idempotent_replay ?? 0);
        const bn = (b.failed ?? 0) + (b.idempotent_replay ?? 0);
        return bn - an;
      })
      .slice(0, 20);
  }, [rows]);

  // Idempotency key replays — usually the most actionable signal.
  const replayKeys = useMemo(() => {
    const map = new Map<string, { story: string; count: number }>();
    for (const r of rows) {
      if (r.event !== "idempotent_replay" && r.event !== "idempotent_join") continue;
      if (!r.idempotency_key) continue;
      const cur = map.get(r.idempotency_key) ?? { story: r.story_id, count: 0 };
      cur.count += 1;
      map.set(r.idempotency_key, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows]);

  const eventList: LifecycleEvent[] = [
    "queued",
    "generating",
    "complete",
    "failed",
    "idempotent_replay",
    "idempotent_join",
    "trigger_rejected",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {t("admin_illustration_analytics.title", "Illustration analytics")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "admin_illustration_analytics.subtitle",
              "Lifecycle events from the illustrate-story pipeline",
            )}
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">
            {t("admin_illustration_analytics.refresh", "Refresh")}
          </span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="range">
              {t("admin_illustration_analytics.range", "Time range")}
            </Label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger id="range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(`admin_illustration_analytics.range_${o.value}`, o.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="story-filter">
              {t("admin_illustration_analytics.story_filter", "Story ID contains")}
            </Label>
            <Input
              id="story-filter"
              value={storyFilter}
              onChange={(e) => setStoryFilter(e.target.value)}
              placeholder="abc123"
            />
          </div>
          <div>
            <Label htmlFor="key-filter">
              {t(
                "admin_illustration_analytics.key_filter",
                "Idempotency key contains",
              )}
            </Label>
            <Input
              id="key-filter"
              value={keyFilter}
              onChange={(e) => setKeyFilter(e.target.value)}
              placeholder="story-id:1-2:1700"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={load} disabled={loading} className="w-full">
              {t("admin_illustration_analytics.apply", "Apply filters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {eventList.map((ev) => (
          <Card key={ev}>
            <CardContent className="pt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {ev}
              </div>
              <div
                className="text-2xl font-bold"
                style={{ color: EVENT_COLORS[ev] }}
                data-testid={`total-${ev}`}
              >
                {totals[ev] ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stacked bar over time */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t(
              "admin_illustration_analytics.chart_title",
              "Events over time",
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {eventList.map((ev) => (
                  <Bar
                    key={ev}
                    dataKey={ev}
                    stackId="events"
                    fill={EVENT_COLORS[ev]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chartData.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t(
                "admin_illustration_analytics.no_data",
                "No events in this range.",
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-story top offenders */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t(
              "admin_illustration_analytics.by_story",
              "Top stories by failures + replays",
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byStory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("admin_illustration_analytics.no_data", "No events in this range.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2">Story</th>
                    {eventList.map((ev) => (
                      <th key={ev} className="py-2 pl-2">{ev}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byStory.map((row) => (
                    <tr key={row.story} className="border-t">
                      <td className="py-1.5 font-mono text-xs" title={row.story}>
                        {truncate(row.story, 18)}
                      </td>
                      {eventList.map((ev) => (
                        <td key={ev} className="py-1.5 pl-2">
                          {(row as Record<string, number | string | undefined>)[ev] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Idempotency replay leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t(
              "admin_illustration_analytics.replay_keys",
              "Top idempotency-key replays",
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {replayKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "admin_illustration_analytics.no_replays",
                "No idempotent replays in this range.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {replayKeys.map((k) => (
                <li
                  key={k.key}
                  className="flex items-center justify-between gap-2 text-sm border-b py-1.5"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate" title={k.key}>
                      {k.key}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {k.story}
                    </div>
                  </div>
                  <Badge variant="secondary">{k.count}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Admin access audit log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            {t(
              "admin_illustration_analytics.audit_title",
              "Access audit log (admins only)",
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAudit(0)}
            disabled={auditLoading}
            data-testid="audit-refresh"
          >
            {auditLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">
              {t("admin_illustration_analytics.refresh", "Refresh")}
            </span>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            {t(
              "admin_illustration_analytics.audit_desc",
              "Every page load and filter change is recorded. Visible only to admins via row-level security.",
            )}
          </p>

          {/* Audit filters */}
          <div className="grid gap-3 md:grid-cols-5 mb-4">
            <div>
              <Label htmlFor="audit-admin">Admin ID</Label>
              <Input
                id="audit-admin"
                data-testid="audit-filter-admin"
                value={auditAdminFilter}
                onChange={(e) => setAuditAdminFilter(e.target.value)}
                placeholder="uuid…"
              />
            </div>
            <div>
              <Label htmlFor="audit-ua">User agent</Label>
              <Input
                id="audit-ua"
                data-testid="audit-filter-ua"
                value={auditUaFilter}
                onChange={(e) => setAuditUaFilter(e.target.value)}
                placeholder="Chrome / Mobile…"
              />
            </div>
            <div>
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                data-testid="audit-filter-from"
                type="datetime-local"
                value={auditFrom}
                onChange={(e) => setAuditFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                data-testid="audit-filter-to"
                type="datetime-local"
                value={auditTo}
                onChange={(e) => setAuditTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => loadAudit(0)}
                disabled={auditLoading}
                className="w-full"
                data-testid="audit-apply"
              >
                Apply
              </Button>
            </div>
          </div>

          {auditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("admin_illustration_analytics.audit_empty", "No access events yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="audit-table">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2">When</th>
                    <th className="py-2 pl-2">Admin</th>
                    <th className="py-2 pl-2">Range</th>
                    <th className="py-2 pl-2">Story filter</th>
                    <th className="py-2 pl-2">Key filter</th>
                    <th className="py-2 pl-2">User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-1.5 whitespace-nowrap">
                        {new Date(a.viewed_at).toLocaleString()}
                      </td>
                      <td className="py-1.5 pl-2 font-mono text-xs" title={a.admin_user_id}>
                        {truncate(a.admin_user_id, 10)}
                      </td>
                      <td className="py-1.5 pl-2">{a.filter_range ?? "—"}</td>
                      <td className="py-1.5 pl-2 font-mono text-xs">
                        {a.filter_story_id ?? "—"}
                      </td>
                      <td className="py-1.5 pl-2 font-mono text-xs">
                        {a.filter_idempotency_key ?? "—"}
                      </td>
                      <td
                        className="py-1.5 pl-2 text-xs text-muted-foreground max-w-xs truncate"
                        title={a.user_agent ?? ""}
                      >
                        {a.user_agent ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground" data-testid="audit-page-info">
              {auditTotal !== null
                ? `Page ${auditPage + 1} of ${Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE))} · ${auditTotal} total`
                : `Page ${auditPage + 1}`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-prev"
                disabled={auditLoading || auditPage === 0}
                onClick={() => loadAudit(Math.max(0, auditPage - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="audit-next"
                disabled={
                  auditLoading ||
                  (auditTotal !== null &&
                    (auditPage + 1) * AUDIT_PAGE_SIZE >= auditTotal)
                }
                onClick={() => loadAudit(auditPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
