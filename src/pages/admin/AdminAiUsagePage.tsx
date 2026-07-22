import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, Cpu, Zap, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type TrialRow = {
  id: string;
  created_at: string;
  provider: string | null;
  model: string | null;
  error_code: string | null;
  latency_ms: number | null;
  fallback_used: boolean;
  stage: string | null;
};

const RANGES = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
} as const;

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminAiUsagePage() {
  const [range, setRange] = useState<keyof typeof RANGES>("7d");
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [storyCount, setStoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - RANGES[range] * 3600 * 1000).toISOString();
    const [trial, stories] = await Promise.all([
      supabase
        .from("trial_usage")
        .select("id, created_at, provider, model, error_code, latency_ms, fallback_used, stage")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("ai_story_history")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);
    setRows((trial.data as TrialRow[]) || []);
    setStoryCount(stories.count || 0);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const errors = rows.filter((r) => r.error_code).length;
    const fallback = rows.filter((r) => r.fallback_used).length;
    const latencies = rows.map((r) => r.latency_ms).filter((n): n is number => typeof n === "number");
    const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    return { total, errors, fallback, avgLatency, errorRate: total ? (errors / total) * 100 : 0 };
  }, [rows]);

  const byProvider = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = r.provider || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const byModel = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = r.model || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rows]);

  const byError = useMemo(() => {
    const map = new Map<string, number>();
    rows.filter((r) => r.error_code).forEach((r) => {
      map.set(r.error_code!, (map.get(r.error_code!) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> AI Usage Monitoring
          </h1>
          <p className="text-sm text-muted-foreground">
            Provider / model usage, fallback rate, errors and latency across story generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Trial calls" value={stats.total} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Authed stories" value={storyCount} icon={<Cpu className="h-4 w-4" />} />
        <StatCard label="Errors" value={`${stats.errors} (${stats.errorRate.toFixed(1)}%)`} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.errorRate > 10 ? "danger" : undefined} />
        <StatCard label="Fallback used" value={stats.fallback} />
        <StatCard label="Avg latency" value={`${stats.avgLatency} ms`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>By provider</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byProvider.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byProvider} dataKey="value" nameKey="name" outerRadius={80} label>
                    {byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top models</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byModel.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byModel}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Errors breakdown</CardTitle></CardHeader>
        <CardContent>
          {byError.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors in this window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead className="text-right">Count</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {byError.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell><Badge variant={e.code === "ai_credits_exhausted" ? "destructive" : "secondary"}>{e.code}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{e.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent trial generations</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.provider || "—"}</TableCell>
                    <TableCell className="text-xs">{r.model || "—"}</TableCell>
                    <TableCell className="text-xs">{r.latency_ms ? `${r.latency_ms} ms` : "—"}</TableCell>
                    <TableCell>
                      {r.error_code ? (
                        <Badge variant="destructive">{r.error_code}</Badge>
                      ) : r.fallback_used ? (
                        <Badge variant="secondary">fallback ok</Badge>
                      ) : (
                        <Badge variant="outline">ok</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-bold mt-1 ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>;
}
