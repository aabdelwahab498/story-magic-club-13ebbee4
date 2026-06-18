import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Users, AlertCircle, DollarSign, Zap } from "lucide-react";
import { toast } from "sonner";
import { fetchUsageStats, fetchUsageLogs, type UsageStats, type AiUsageLog } from "@/lib/aiAdminApi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export default function AdminAiAnalyticsPage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [logs, setLogs] = useState<AiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, l] = await Promise.all([fetchUsageStats(30), fetchUsageLogs(50)]);
        setStats(s); setLogs(l);
      } catch { toast.error("Failed to load analytics"); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (!stats) return null;

  const cards = [
    { label: "Total Requests (30d)", value: stats.totalRequests.toLocaleString(), icon: Activity, color: "text-primary" },
    { label: "Active Users", value: stats.activeUsers, icon: Users, color: "text-emerald-500" },
    { label: "Avg Latency", value: `${stats.avgLatency}ms`, icon: Zap, color: "text-amber-500" },
    { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-rose-500" },
    { label: "Est. Cost", value: `$${stats.totalCost.toFixed(4)}`, icon: DollarSign, color: "text-violet-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Activity className="h-7 w-7" /> AI Analytics</h1>
        <p className="text-muted-foreground">Last 30 days of AI usage across all features.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Requests by Feature</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byFeature}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Daily Requests & Cost</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" />
                <YAxis yAxisId="r" orientation="right" />
                <Tooltip />
                <Line yAxisId="l" type="monotone" dataKey="count" stroke="hsl(var(--primary))" />
                <Line yAxisId="r" type="monotone" dataKey="cost" stroke="hsl(var(--accent))" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Requests</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xs overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">When</th><th className="p-2">Feature</th><th className="p-2">Model</th><th className="p-2">Tokens</th><th className="p-2">Latency</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-2"><Badge variant="outline">{l.feature_key}</Badge></td>
                    <td className="p-2">{l.model ?? "—"}</td>
                    <td className="p-2">{(l.tokens_in ?? 0) + (l.tokens_out ?? 0)}</td>
                    <td className="p-2">{l.latency_ms ?? "—"}ms</td>
                    <td className="p-2"><Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No requests logged yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
