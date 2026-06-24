import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  Download as DownloadIcon,
  BarChart3,
  Users as UsersIcon,
  ScrollText,
  AlertTriangle,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchDownloadSettings,
  updateDownloadSettings,
  fetchDownloadsByFormat,
  fetchTodayUserUsage,
  fetchDownloadAudit,
  fetchDownloadAlerts,
  DEFAULT_DOWNLOAD_SETTINGS,
  type DownloadSettings,
  type DownloadFormat,
  type DownloadOutcome,
} from "@/lib/storyDownloads";

const FORMATS: { key: keyof DownloadSettings; label: string; desc: string }[] = [
  { key: "enable_pdf", label: "PDF", desc: "Designed PDF export" },
  { key: "enable_mp3", label: "MP3", desc: "Narration audio download" },
  { key: "enable_txt", label: "TXT", desc: "Plain text (always free)" },
  { key: "enable_docx", label: "DOCX", desc: "Microsoft Word document" },
  { key: "enable_epub", label: "EPUB", desc: "E-reader format" },
  { key: "enable_images", label: "Images (ZIP)", desc: "Illustrations bundle" },
  { key: "enable_pack", label: "Complete Pack", desc: "All formats bundled" },
];

const ALL_FORMATS: DownloadFormat[] = ["pdf", "mp3", "txt", "docx", "epub", "images", "pack"];

export default function AdminDownloadsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <DownloadIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Download Management</h1>
        </div>
        <p className="text-muted-foreground">
          Settings, analytics, per-user usage, audit log and alerts.
        </p>
      </header>

      <Tabs defaultValue="settings">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 me-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 me-1.5" />Analytics</TabsTrigger>
          <TabsTrigger value="users"><UsersIcon className="h-4 w-4 me-1.5" />Users Today</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 me-1.5" />Audit Log</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 me-1.5" />Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------- Settings ----------------------- */
function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULT_DOWNLOAD_SETTINGS);

  useEffect(() => {
    fetchDownloadSettings()
      .then(setSettings)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof DownloadSettings>(k: K, v: DownloadSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDownloadSettings(settings);
      toast.success("Download settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6 mt-4">
      <section className="bg-card border rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold mb-3">Available formats</h2>
        <div className="divide-y">
          {FORMATS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={settings[key] as boolean}
                onCheckedChange={(v) => update(key, v as never)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold">Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="daily">Daily downloads per user</Label>
            <Input
              id="daily"
              type="number"
              min={1}
              max={1000}
              value={settings.daily_limit_per_user}
              onChange={(e) =>
                update("daily_limit_per_user", Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          <div>
            <Label htmlFor="size">Max file size (MB)</Label>
            <Input
              id="size"
              type="number"
              min={1}
              max={2048}
              value={settings.max_file_size_mb}
              onChange={(e) =>
                update("max_file_size_mb", Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
        </div>
      </section>

      <section className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold">Alert delivery</h2>
          <p className="text-xs text-muted-foreground">
            Email & Slack channels for threshold breaches.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Send alerts by email</p>
            <p className="text-xs text-muted-foreground">Requires a verified email domain.</p>
          </div>
          <Switch
            checked={settings.alerts_email_enabled}
            onCheckedChange={(v) => update("alerts_email_enabled", v)}
          />
        </div>
        <div>
          <Label htmlFor="alert_email">Admin email</Label>
          <Input
            id="alert_email"
            type="email"
            placeholder="admin@example.com"
            value={settings.alert_email ?? ""}
            onChange={(e) => update("alert_email", e.target.value || null)}
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-semibold">Send alerts to Slack</p>
            <p className="text-xs text-muted-foreground">Requires a connected Slack workspace.</p>
          </div>
          <Switch
            checked={settings.alerts_slack_enabled}
            onCheckedChange={(v) => update("alerts_slack_enabled", v)}
          />
        </div>
        <div>
          <Label htmlFor="slack_channel_id">Slack channel ID</Label>
          <Input
            id="slack_channel_id"
            placeholder="C0123456789"
            value={settings.slack_channel_id ?? ""}
            onChange={(e) => update("slack_channel_id", e.target.value || null)}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2 rounded-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

/* ----------------------- Analytics ----------------------- */
function AnalyticsTab() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-downloads-analytics", days],
    queryFn: () => fetchDownloadsByFormat(days),
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of data.daily) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[p.format] = (row[p.format] as number | undefined ?? 0) + p.count;
      byDate.set(p.date, row);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [data]);

  const colors: Record<DownloadFormat, string> = {
    pdf: "#ef4444",
    mp3: "#ec4899",
    txt: "#64748b",
    docx: "#3b82f6",
    epub: "#8b5cf6",
    images: "#f59e0b",
    pack: "#10b981",
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Range:</Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
          <SelectTrigger className="w-40 rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total downloads" value={data.total} />
            {ALL_FORMATS.map((f) => (
              <StatCard
                key={f}
                label={f.toUpperCase()}
                value={data.totalByFormat[f] ?? 0}
                color={colors[f]}
              />
            ))}
          </section>

          <section className="bg-card border rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold mb-3">Downloads per day</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {ALL_FORMATS.map((f) => (
                    <Bar key={f} dataKey={f} stackId="a" fill={colors[f]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ----------------------- Users ----------------------- */
function UsersTab() {
  const { data: settings } = useQuery({
    queryKey: ["download-settings"],
    queryFn: fetchDownloadSettings,
  });
  const limit = settings?.daily_limit_per_user ?? DEFAULT_DOWNLOAD_SETTINGS.daily_limit_per_user;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-downloads-users-today", limit],
    queryFn: () => fetchTodayUserUsage(limit),
    enabled: !!settings,
  });

  if (isLoading || !data) return <Spinner />;
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12">
        No downloads recorded today.
      </p>
    );
  }

  return (
    <div className="mt-4 bg-card border rounded-2xl shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Downloads today</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((u) => (
            <TableRow key={u.user_id}>
              <TableCell className="font-mono text-xs">
                {u.display_name ?? u.user_id.slice(0, 8) + "…"}
              </TableCell>
              <TableCell>
                {u.count_today} / {limit}
              </TableCell>
              <TableCell className="w-48">
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(u.percent, 100)} className="flex-1" />
                  <span className="text-xs w-10 text-end">{u.percent}%</span>
                </div>
              </TableCell>
              <TableCell>
                {u.over_limit ? (
                  <Badge variant="destructive">Over limit</Badge>
                ) : u.near_limit ? (
                  <Badge className="bg-amber-500 text-white">Near limit</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ----------------------- Audit log ----------------------- */
function AuditTab() {
  const [userId, setUserId] = useState("");
  const [format, setFormat] = useState<DownloadFormat | "all">("all");
  const [outcome, setOutcome] = useState<DownloadOutcome | "all">("all");
  const [sinceDays, setSinceDays] = useState<1 | 7 | 30 | 90>(7);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-downloads-audit", userId, format, outcome, sinceDays],
    queryFn: () =>
      fetchDownloadAudit({
        userId: userId.trim() || null,
        format: format === "all" ? null : format,
        outcome: outcome === "all" ? null : outcome,
        sinceDays,
      }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">User ID</Label>
          <Input
            placeholder="uuid…"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as DownloadFormat | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {ALL_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Outcome</Label>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as DownloadOutcome | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Since</Label>
          <Select value={String(sinceDays)} onValueChange={(v) => setSinceDays(Number(v) as 1 | 7 | 30 | 90)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No matching events.</p>
      ) : (
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Story</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.user_id?.slice(0, 8) ?? "—"}…
                  </TableCell>
                  <TableCell>{r.format.toUpperCase()}</TableCell>
                  <TableCell>
                    {r.outcome === "success" ? (
                      <Badge className="bg-emerald-500 text-white">success</Badge>
                    ) : r.outcome === "rejected" ? (
                      <Badge className="bg-amber-500 text-white">rejected</Badge>
                    ) : (
                      <Badge variant="destructive">error</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[18ch] truncate">
                    {r.story_title ?? r.story_id ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Alerts ----------------------- */
function AlertsTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-downloads-alerts"],
    queryFn: fetchDownloadAlerts,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Computed from the last 24h. Auto-refreshes every minute.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold">All clear</p>
          <p className="text-sm text-muted-foreground">No threshold breaches in the last 24h.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((a, i) => (
            <div
              key={i}
              className={`border rounded-2xl p-4 shadow-sm flex items-start gap-3 ${
                a.severity === "critical"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-500/40 bg-amber-500/5"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 mt-0.5 ${
                  a.severity === "critical" ? "text-destructive" : "text-amber-500"
                }`}
              />
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
                <Badge variant="outline" className="mt-1 capitalize">{a.kind.replace("_", " ")}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/40 border rounded-2xl p-4 text-sm">
        <p className="font-semibold mb-1">📬 Email / Slack delivery</p>
        <p className="text-muted-foreground">
          In-app alerts are active. Outbound email / Slack notifications can be wired through the
          Lovable Emails or Slack connector — tell me which channel you prefer and I'll set it up.
        </p>
      </div>
    </div>
  );
}

/* ----------------------- Shared ----------------------- */
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
