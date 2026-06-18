import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, Download } from "lucide-react";
import { toast } from "sonner";
import { fetchAuditLogs, type AiAuditLog } from "@/lib/aiAdminApi";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try { setLogs(await fetchAuditLogs(500)); } catch { toast.error("Failed to load"); }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter((l) =>
      l.action.toLowerCase().includes(s) ||
      l.entity_type.toLowerCase().includes(s) ||
      (l.entity_id ?? "").toLowerCase().includes(s)
    );
  }, [logs, q]);

  const exportCsv = () => {
    const header = "when,actor,action,entity_type,entity_id\n";
    const body = filtered.map((l) =>
      [l.created_at, l.actor_id ?? "", l.action, l.entity_type, l.entity_id ?? ""].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ScrollText className="h-7 w-7" /> Audit Logs</h1>
          <p className="text-muted-foreground">Track every admin action across the AI system.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search action, entity..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
        </div>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Card>
          <CardHeader><CardTitle>{filtered.length} entries</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">When</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">ID</th></tr></thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="p-2 font-mono">{l.actor_id?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2"><Badge variant="outline">{l.action}</Badge></td>
                      <td className="p-2">{l.entity_type}</td>
                      <td className="p-2 font-mono">{l.entity_id?.slice(0, 8) ?? "—"}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No audit logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
