import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ScrollText, Download, FileText, FilterX } from "lucide-react";
import { toast } from "sonner";
import { fetchAuditLogs, type AiAuditLog } from "@/lib/aiAdminApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type StatusFilter = "all" | "success" | "failure";

function detectStatus(action: string): "success" | "failure" {
  const a = action.toLowerCase();
  if (a.includes("fail") || a.includes("error") || a.includes("denied") || a.includes("reject")) {
    return "failure";
  }
  return "success";
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const load = async () => {
    setLoading(true);
    try {
      setLogs(await fetchAuditLogs(1000));
    } catch {
      toast.error("Failed to load audit logs");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const u = userFilter.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86_400_000 : null;
    return logs.filter((l) => {
      if (s) {
        const match =
          l.action.toLowerCase().includes(s) ||
          l.entity_type.toLowerCase().includes(s) ||
          (l.entity_id ?? "").toLowerCase().includes(s);
        if (!match) return false;
      }
      if (u && !(l.actor_id ?? "").toLowerCase().includes(u)) return false;
      const ts = new Date(l.created_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (status !== "all" && detectStatus(l.action) !== status) return false;
      return true;
    });
  }, [logs, q, userFilter, from, to, status]);

  const rows = (l: AiAuditLog) => [
    new Date(l.created_at).toLocaleString(),
    l.actor_id ?? "—",
    l.action,
    detectStatus(l.action),
    l.entity_type,
    l.entity_id ?? "—",
  ];

  const exportCsv = () => {
    const header = ["When", "Actor", "Action", "Status", "Entity", "Entity ID"];
    const lines = [header, ...filtered.map(rows)]
      .map((cols) =>
        cols.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} rows`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Admin Audit Logs", 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Generated ${new Date().toLocaleString()} • ${filtered.length} entries`,
      14,
      20
    );
    autoTable(doc, {
      startY: 26,
      head: [["When", "Actor", "Action", "Status", "Entity", "Entity ID"]],
      body: filtered.map(rows),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    doc.save(`audit-logs-${Date.now()}.pdf`);
    toast.success(`Exported ${filtered.length} rows`);
  };

  const clearFilters = () => {
    setQ("");
    setUserFilter("");
    setFrom("");
    setTo("");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScrollText className="h-7 w-7" /> Audit Logs
          </h1>
          <p className="text-muted-foreground">
            Track every admin action across the AI system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Action / entity..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">User ID</Label>
            <Input
              placeholder="actor uuid"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4 mr-1" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{filtered.length} entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">When</th>
                    <th className="p-2">Actor</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Entity</th>
                    <th className="p-2">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const st = detectStatus(l.action);
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td className="p-2 font-mono">
                          {l.actor_id?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{l.action}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={st === "success" ? "default" : "destructive"}
                          >
                            {st}
                          </Badge>
                        </td>
                        <td className="p-2">{l.entity_type}</td>
                        <td className="p-2 font-mono">
                          {l.entity_id?.slice(0, 8) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-muted-foreground"
                      >
                        No audit logs match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
