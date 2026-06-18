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
import {
  Loader2,
  ScrollText,
  Download,
  FileText,
  FilterX,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { fetchAuditLogsPaged, type AiAuditLog } from "@/lib/aiAdminApi";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type StatusFilter = "all" | "success" | "failure";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

function detectStatus(action: string): "success" | "failure" {
  const a = action.toLowerCase();
  if (
    a.includes("fail") ||
    a.includes("error") ||
    a.includes("denied") ||
    a.includes("reject")
  ) {
    return "failure";
  }
  return "success";
}

function slugifyFilters(parts: Record<string, string>) {
  const flat = Object.entries(parts)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}-${v.trim().replace(/[^a-z0-9]+/gi, "_").slice(0, 20)}`)
    .join("_");
  return flat ? `_${flat}` : "";
}

export default function AdminAuditLogsPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission("view_audit_logs");

  const [rows, setRows] = useState<AiAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogsPaged({
        page,
        pageSize,
        userId: userFilter.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        search: q.trim() || undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message === "not_authenticated" ? "Please sign in" : "Failed to load audit logs");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canView, page, pageSize, userFilter, from, to, q]);

  // Status filter is client-side (derived from action text)
  const visible = useMemo(
    () => (status === "all" ? rows : rows.filter((l) => detectStatus(l.action) === status)),
    [rows, status]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtersSummary = useMemo(
    () =>
      [
        userFilter && `User: ${userFilter}`,
        from && `From: ${from}`,
        to && `To: ${to}`,
        status !== "all" && `Status: ${status}`,
        q && `Search: "${q}"`,
      ]
        .filter(Boolean)
        .join("  •  ") || "No filters applied",
    [userFilter, from, to, status, q]
  );

  const toRow = (l: AiAuditLog) => [
    new Date(l.created_at).toLocaleString(),
    l.actor_id ?? "—",
    l.action,
    detectStatus(l.action),
    l.entity_type,
    l.entity_id ?? "—",
  ];

  const buildFileName = (ext: "csv" | "pdf") => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filters = slugifyFilters({
      user: userFilter,
      from,
      to,
      status: status === "all" ? "" : status,
      q,
    });
    return `audit-logs_${stamp}${filters}.${ext}`;
  };

  const exportCsv = () => {
    const meta = [
      `# Exported: ${new Date().toISOString()}`,
      `# Filters: ${filtersSummary}`,
      `# Rows: ${visible.length} of ${total} total`,
    ].join("\n");
    const header = ["When", "Actor", "Action", "Status", "Entity", "Entity ID"];
    const lines = [header, ...visible.map(toRow)]
      .map((cols) => cols.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([meta + "\n" + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFileName("csv");
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visible.length} rows`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Admin Audit Logs", 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
    doc.text(`Filters: ${filtersSummary}`, 14, 25);
    doc.text(`Showing ${visible.length} of ${total} total entries`, 14, 30);
    autoTable(doc, {
      startY: 35,
      head: [["When", "Actor", "Action", "Status", "Entity", "Entity ID"]],
      body: visible.map(toRow),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    doc.save(buildFileName("pdf"));
    toast.success(`Exported ${visible.length} rows`);
  };

  const clearFilters = () => {
    setQ("");
    setUserFilter("");
    setFrom("");
    setTo("");
    setStatus("all");
    setPage(0);
  };

  if (authLoading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  if (!canView) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Access denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You don't have the <code>view_audit_logs</code> permission. Ask an administrator to grant it via the RBAC page.
        </CardContent>
      </Card>
    );
  }

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
          <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={!visible.length}>
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
              onChange={(e) => {
                setPage(0);
                setQ(e.target.value);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">User ID</Label>
            <Input
              placeholder="actor uuid"
              value={userFilter}
              onChange={(e) => {
                setPage(0);
                setUserFilter(e.target.value);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(0);
                setFrom(e.target.value);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(0);
                setTo(e.target.value);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
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
          <div className="md:col-span-5 flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{filtersSummary}</p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4 mr-1" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>
            {loading ? "Loading…" : `${visible.length} shown • ${total} total`}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPage(0);
                setPageSize(Number(v));
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
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
                    {visible.map((l) => {
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
                            <Badge variant={st === "success" ? "default" : "destructive"}>
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
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          No audit logs match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 text-xs">
                <span className="text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page + 1 >= totalPages}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
