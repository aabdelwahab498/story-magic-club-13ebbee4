import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, CheckCircle2, XCircle, Package, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getLocalized } from "@/lib/multilingual";

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  fulfillment_status: string;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  paddle_transaction_id: string | null;
  paddle_checkout_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  admin_note: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  notes: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  currency: string;
  product_snapshot: any;
};

type TabKey = "pending" | "paid" | "unfulfilled" | "fulfilled" | "all";

const tabs: { key: TabKey; ar: string; en: string }[] = [
  { key: "paid", ar: "مدفوع (Paddle)", en: "Paid (Paddle)" },
  { key: "unfulfilled", ar: "بانتظار التسليم", en: "Awaiting Delivery" },
  { key: "fulfilled", ar: "تم التسليم", en: "Fulfilled" },
  { key: "pending", ar: "قيد الدفع", en: "Pending payment" },
  { key: "all", ar: "الكل", en: "All" },
];

const AdminOrdersPage = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("paid");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["admin-orders", tab],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
      if (tab === "paid") query = query.eq("status", "paid");
      else if (tab === "pending") query = query.eq("status", "pending");
      else if (tab === "unfulfilled") query = query.eq("status", "paid").eq("fulfillment_status", "unfulfilled");
      else if (tab === "fulfilled") query = query.eq("fulfillment_status", "fulfilled");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const items = useQuery({
    queryKey: ["admin-order-items", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", selected!.id);
      if (error) throw error;
      return (data ?? []) as OrderItem[];
    },
  });

  const openDetail = (o: OrderRow) => {
    setSelected(o);
    setNote(o.admin_note ?? "");
  };

  const mark = async (action: "fulfilled" | "cancelled") => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          fulfillment_status: action,
          fulfilled_at: action === "fulfilled" ? new Date().toISOString() : null,
          fulfilled_by: user.id,
          admin_note: note.trim() || null,
          ...(action === "cancelled" ? { status: "cancelled" } : {}),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast({
        title:
          action === "fulfilled"
            ? t("admin_orders.marked_fulfilled", "Marked as fulfilled")
            : t("admin_orders.marked_cancelled", "Marked as cancelled"),
      });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] ?? "bg-muted"}`}>{s}</span>;
  };

  const fulfillBadge = (s: string) => {
    const map: Record<string, string> = {
      fulfilled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      unfulfilled: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] ?? "bg-muted"}`}>{s}</span>;
  };

  const totalsByMethod = useMemo(() => {
    const m: Record<string, { count: number; total: number }> = {};
    for (const o of q.data ?? []) {
      if (o.status !== "paid") continue;
      const k = o.payment_method ?? "unknown";
      m[k] = m[k] ?? { count: 0, total: 0 };
      m[k].count += 1;
      m[k].total += Number(o.total_amount ?? 0);
    }
    return m;
  }, [q.data]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            {t("admin_orders.title", "Store Orders")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "admin_orders.subtitle",
              "Track real Paddle payments and approve product delivery.",
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(totalsByMethod).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="rounded-full gap-1">
              <CreditCard className="h-3 w-3" />
              {k}: {v.count} · ${v.total.toFixed(2)}
            </Badge>
          ))}
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
              tab === tb.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-foreground"
            }`}
          >
            {isAr ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {q.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

      <div className="overflow-x-auto bg-white dark:bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">{t("admin_orders.date", "Date")}</th>
              <th className="text-start p-3">{t("admin_orders.order", "Order")}</th>
              <th className="text-start p-3">{t("admin_orders.amount", "Amount")}</th>
              <th className="text-start p-3">{t("admin_orders.method", "Method")}</th>
              <th className="text-start p-3">{t("admin_orders.payment", "Payment")}</th>
              <th className="text-start p-3">{t("admin_orders.delivery", "Delivery")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((o) => (
              <tr key={o.id} className="border-t border-muted">
                <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="p-3 font-bold">{Number(o.total_amount).toFixed(2)} {o.currency}</td>
                <td className="p-3 capitalize">{(o.payment_method ?? "—").replace("_", " ")}</td>
                <td className="p-3">{statusBadge(o.status)}</td>
                <td className="p-3">{fulfillBadge(o.fulfillment_status)}</td>
                <td className="p-3">
                  <button
                    onClick={() => openDetail(o)}
                    className="p-2 rounded-lg hover:bg-accent"
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  {t("admin_orders.empty", "No orders here yet.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin_orders.details", "Order details")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><b>ID:</b> <span className="font-mono">{selected.id.slice(0, 8)}</span></div>
                <div><b>{t("admin_orders.amount", "Amount")}:</b> {selected.total_amount} {selected.currency}</div>
                <div><b>{t("admin_orders.method", "Method")}:</b> {selected.payment_method ?? "—"}</div>
                <div><b>{t("admin_orders.payment", "Payment")}:</b> {selected.status}</div>
                <div><b>{t("admin_orders.delivery", "Delivery")}:</b> {selected.fulfillment_status}</div>
                <div><b>{t("admin_orders.paid_at", "Paid at")}:</b> {selected.paid_at ? new Date(selected.paid_at).toLocaleString() : "—"}</div>
                {selected.paddle_transaction_id && (
                  <div className="col-span-2"><b>Paddle TX:</b> <span className="font-mono text-xs">{selected.paddle_transaction_id}</span></div>
                )}
                <div className="col-span-2 border-t pt-2"><b>{t("admin_orders.customer", "Customer")}:</b> {selected.shipping_name ?? "—"} · {selected.shipping_phone ?? "—"}</div>
                <div className="col-span-2 text-muted-foreground">
                  {[selected.shipping_address, selected.shipping_city, selected.shipping_country].filter(Boolean).join(", ") || "—"}
                </div>
                {selected.notes && (
                  <div className="col-span-2"><b>{t("admin_orders.notes", "Customer notes")}:</b> {selected.notes}</div>
                )}
              </div>

              <div className="rounded-xl border-2 border-muted p-3 bg-muted/20">
                <p className="font-bold text-sm mb-2">{t("admin_orders.items", "Items")}</p>
                {items.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ul className="space-y-1 text-sm">
                    {items.data?.map((it) => (
                      <li key={it.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {getLocalized(it.product_snapshot?.name, i18n.language) ||
                            it.product_snapshot?.sku ||
                            "—"} × {it.quantity}
                        </span>
                        <span className="font-bold whitespace-nowrap">
                          {(Number(it.unit_price) * it.quantity).toFixed(2)} {it.currency}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block">
                  {t("admin_orders.admin_note", "Admin note (optional)")}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-muted bg-background text-sm"
                  rows={2}
                />
              </div>

              {selected.fulfillment_status !== "fulfilled" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => mark("fulfilled")}
                    disabled={busy || selected.status !== "paid"}
                    className="flex-1 px-4 py-2.5 rounded-full bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t("admin_orders.approve_delivery", "Approve & deliver")}
                  </button>
                  <button
                    onClick={() => mark("cancelled")}
                    disabled={busy}
                    className="flex-1 px-4 py-2.5 rounded-full bg-red-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> {t("admin_orders.cancel_order", "Cancel order")}
                  </button>
                </div>
              )}
              {selected.status !== "paid" && (
                <p className="text-xs text-amber-600">
                  {t(
                    "admin_orders.payment_not_received",
                    "Payment not received yet. Wait for Paddle confirmation before approving delivery.",
                  )}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrdersPage;
