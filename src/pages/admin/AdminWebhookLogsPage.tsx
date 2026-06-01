import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Webhook, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Event = {
  id: string;
  event_id: string;
  event_type: string;
  payload: any;
  processed_at: string | null;
  error: string | null;
  created_at: string;
};

const AdminWebhookLogsPage = () => {
  const { t } = useTranslation();
  const [txFilter, setTxFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "processed" | "errored" | "pending">("all");
  const [selected, setSelected] = useState<Event | null>(null);

  const q = useQuery({
    queryKey: ["paddle-webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paddle_webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Event[];
    },
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => {
    const tx = txFilter.trim().toLowerCase();
    const typ = typeFilter.trim().toLowerCase();
    return (q.data ?? []).filter((e) => {
      if (statusFilter === "processed" && !e.processed_at) return false;
      if (statusFilter === "errored" && !e.error) return false;
      if (statusFilter === "pending" && (e.processed_at || e.error)) return false;
      if (typ && !e.event_type.toLowerCase().includes(typ)) return false;
      if (tx) {
        const txId = e.payload?.data?.id ?? "";
        const checkoutId = e.payload?.data?.checkout?.id ?? "";
        const subId = e.payload?.data?.subscription_id ?? "";
        const hay = `${e.event_id} ${txId} ${checkoutId} ${subId}`.toLowerCase();
        if (!hay.includes(tx)) return false;
      }
      return true;
    });
  }, [q.data, txFilter, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const list = q.data ?? [];
    return {
      total: list.length,
      processed: list.filter((e) => !!e.processed_at && !e.error).length,
      errored: list.filter((e) => !!e.error).length,
      pending: list.filter((e) => !e.processed_at && !e.error).length,
    };
  }, [q.data]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Webhook className="h-6 w-6 text-primary" />
          {t("admin_webhooks.title", "Paddle Webhook Logs")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin_webhooks.subtitle", "All Paddle events received, their processing result, and errors.")}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "total", icon: Webhook, color: "text-primary", val: stats.total, lbl: t("admin_webhooks.total", "Total") },
          { k: "processed", icon: CheckCircle2, color: "text-emerald-600", val: stats.processed, lbl: t("admin_webhooks.processed", "Processed") },
          { k: "pending", icon: Clock, color: "text-amber-600", val: stats.pending, lbl: t("admin_webhooks.pending", "Pending") },
          { k: "errored", icon: AlertCircle, color: "text-red-600", val: stats.errored, lbl: t("admin_webhooks.errored", "Errored") },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl bg-card border-2 border-muted p-3">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase ${s.color}`}>
              <s.icon className="h-4 w-4" /> {s.lbl}
            </div>
            <div className="text-2xl font-extrabold mt-1">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={txFilter}
            onChange={(e) => setTxFilter(e.target.value)}
            placeholder={t("admin_webhooks.tx_filter", "Filter by transaction / checkout / event id…")}
            className="ps-9"
          />
        </div>
        <Input
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder={t("admin_webhooks.type_filter", "Filter by event_type (e.g. transaction.completed)")}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border-2 border-muted bg-background px-3 py-2 text-sm"
        >
          <option value="all">{t("admin_webhooks.all", "All statuses")}</option>
          <option value="processed">{t("admin_webhooks.processed", "Processed")}</option>
          <option value="pending">{t("admin_webhooks.pending", "Pending")}</option>
          <option value="errored">{t("admin_webhooks.errored", "Errored")}</option>
        </select>
      </div>

      {q.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

      <div className="overflow-x-auto bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">{t("admin_webhooks.time", "Time")}</th>
              <th className="text-start p-3">{t("admin_webhooks.event", "Event")}</th>
              <th className="text-start p-3">{t("admin_webhooks.tx", "Transaction")}</th>
              <th className="text-start p-3">{t("admin_webhooks.status", "Status")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const txId = e.payload?.data?.id ?? "—";
              const errored = !!e.error;
              const processed = !!e.processed_at;
              return (
                <tr key={e.id} className="border-t border-muted">
                  <td className="p-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{e.event_type}</td>
                  <td className="p-3 font-mono text-xs truncate max-w-[180px]">{txId}</td>
                  <td className="p-3">
                    {errored ? (
                      <span className="inline-flex items-center gap-1 text-red-700"><AlertCircle className="h-3 w-3" /> error</span>
                    ) : processed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> processed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="h-3 w-3" /> pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelected(e)}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground"
                    >
                      {t("admin_webhooks.view", "View")}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                {t("admin_webhooks.empty", "No webhook events match these filters.")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.event_type}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><b>event_id:</b> <span className="font-mono text-xs">{selected.event_id}</span></div>
                <div><b>received:</b> {new Date(selected.created_at).toLocaleString()}</div>
                <div><b>processed_at:</b> {selected.processed_at ? new Date(selected.processed_at).toLocaleString() : "—"}</div>
                <div><b>error:</b> <span className="text-red-700">{selected.error ?? "—"}</span></div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 overflow-x-auto">
                <pre className="text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWebhookLogsPage;
