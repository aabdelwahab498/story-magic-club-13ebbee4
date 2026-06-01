import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Eye, CheckCircle2, XCircle, Package, CreditCard,
  Truck, MapPin, Mail, Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLocalized } from "@/lib/multilingual";

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  fulfillment_status: string;
  shipping_status: string;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  paddle_transaction_id: string | null;
  paddle_checkout_id: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
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

type NotificationRow = {
  id: string;
  event: string;
  channel: string;
  status: string;
  recipient: string | null;
  error: string | null;
  created_at: string;
};

type TabKey = "paid" | "unfulfilled" | "to_ship" | "shipped" | "delivered" | "pending" | "all";

const tabs: { key: TabKey; ar: string; en: string }[] = [
  { key: "paid",        ar: "مدفوع (Paddle)",   en: "Paid (Paddle)" },
  { key: "unfulfilled", ar: "بانتظار الموافقة", en: "Awaiting approval" },
  { key: "to_ship",     ar: "جاهز للشحن",       en: "Ready to ship" },
  { key: "shipped",     ar: "مُشحن",            en: "Shipped" },
  { key: "delivered",   ar: "تم التسليم",       en: "Delivered" },
  { key: "pending",     ar: "قيد الدفع",        en: "Pending payment" },
  { key: "all",         ar: "الكل",             en: "All" },
];

const AdminOrdersPage = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("paid");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["admin-orders", tab],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
      if (tab === "paid") query = query.eq("status", "paid");
      else if (tab === "pending") query = query.eq("status", "pending");
      else if (tab === "unfulfilled") query = query.eq("status", "paid").eq("fulfillment_status", "unfulfilled");
      else if (tab === "to_ship") query = query.eq("fulfillment_status", "fulfilled").eq("shipping_status", "not_shipped");
      else if (tab === "shipped") query = query.eq("shipping_status", "shipped");
      else if (tab === "delivered") query = query.eq("shipping_status", "delivered");
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
        .from("order_items").select("*").eq("order_id", selected!.id);
      if (error) throw error;
      return (data ?? []) as OrderItem[];
    },
  });

  const notifs = useQuery({
    queryKey: ["admin-order-notifs", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_notifications").select("*")
        .eq("order_id", selected!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const openDetail = (o: OrderRow) => {
    setSelected(o);
    setNote(o.admin_note ?? "");
    setTrackingNumber(o.tracking_number ?? "");
    setTrackingCarrier(o.tracking_carrier ?? "");
  };

  const notify = async (event: string) => {
    if (!selected) return;
    try {
      const { data, error } = await supabase.functions.invoke("send-order-notification", {
        body: { order_id: selected.id, event, admin_note: note.trim() || undefined },
      });
      if (error) throw error;
      const s = (data as any)?.email_status;
      if (s === "queued") {
        toast({ title: t("admin_orders.notif_sent", "Notification sent to customer") });
      } else if (s === "skipped") {
        toast({
          title: t("admin_orders.notif_logged", "Notification logged"),
          description: t(
            "admin_orders.email_not_configured",
            "Set up an email domain to actually deliver these messages.",
          ),
        });
      } else {
        toast({ title: t("admin_orders.notif_failed", "Notification failed"), variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["admin-order-notifs", selected.id] });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const persistTracking = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("orders").update({
        tracking_number: trackingNumber.trim() || null,
        tracking_carrier: trackingCarrier.trim() || null,
        admin_note: note.trim() || null,
      }).eq("id", selected.id);
      if (error) throw error;
      toast({ title: t("admin_orders.tracking_saved", "Tracking updated") });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      // Refresh selected
      const refreshed = (q.data ?? []).find((o) => o.id === selected.id);
      if (refreshed) setSelected({
        ...refreshed,
        tracking_number: trackingNumber.trim() || null,
        tracking_carrier: trackingCarrier.trim() || null,
        admin_note: note.trim() || null,
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const transition = async (
    action: "approve" | "pack" | "ship" | "deliver" | "cancel",
  ) => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      const patch: Record<string, any> = { admin_note: note.trim() || null };
      let eventName: string | null = null;

      if (action === "approve") {
        patch.fulfillment_status = "fulfilled";
        patch.fulfilled_at = new Date().toISOString();
        patch.fulfilled_by = user.id;
        eventName = "fulfilled";
      } else if (action === "pack") {
        patch.shipping_status = "packed";
      } else if (action === "ship") {
        patch.shipping_status = "shipped";
        patch.shipped_at = new Date().toISOString();
        patch.tracking_number = trackingNumber.trim() || null;
        patch.tracking_carrier = trackingCarrier.trim() || null;
        eventName = "shipped";
      } else if (action === "deliver") {
        patch.shipping_status = "delivered";
        patch.delivered_at = new Date().toISOString();
        eventName = "delivered";
      } else if (action === "cancel") {
        patch.status = "cancelled";
        patch.fulfillment_status = "cancelled";
        eventName = "cancelled";
      }

      const { error } = await supabase.from("orders").update(patch as any).eq("id", selected.id);
      if (error) throw error;
      toast({ title: t("admin_orders.updated", "Order updated") });

      if (eventName) {
        await notify(eventName);
      }
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-800",
      pending: "bg-amber-100 text-amber-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] ?? "bg-muted"}`}>{s}</span>;
  };

  const fulfillBadge = (s: string) => {
    const map: Record<string, string> = {
      fulfilled: "bg-emerald-100 text-emerald-800",
      unfulfilled: "bg-slate-100 text-slate-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] ?? "bg-muted"}`}>{s}</span>;
  };

  const shipBadge = (s: string) => {
    const map: Record<string, string> = {
      not_shipped: "bg-slate-100 text-slate-700",
      packed: "bg-amber-100 text-amber-800",
      shipped: "bg-sky-100 text-sky-800",
      delivered: "bg-emerald-100 text-emerald-800",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] ?? "bg-muted"}`}>{s.replace("_", " ")}</span>;
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
            {t("admin_orders.subtitle", "Real Paddle payments, fulfillment, shipping, and customer notifications.")}
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

      <div className="overflow-x-auto bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">{t("admin_orders.date", "Date")}</th>
              <th className="text-start p-3">{t("admin_orders.order", "Order")}</th>
              <th className="text-start p-3">{t("admin_orders.customer", "Customer")}</th>
              <th className="text-start p-3">{t("admin_orders.amount", "Amount")}</th>
              <th className="text-start p-3">{t("admin_orders.payment", "Payment")}</th>
              <th className="text-start p-3">{t("admin_orders.delivery", "Delivery")}</th>
              <th className="text-start p-3">{t("admin_orders.shipping", "Shipping")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((o) => (
              <tr key={o.id} className="border-t border-muted">
                <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="p-3 max-w-[160px] truncate">{o.shipping_name ?? "—"}</td>
                <td className="p-3 font-bold whitespace-nowrap">{Number(o.total_amount).toFixed(2)} {o.currency}</td>
                <td className="p-3">{statusBadge(o.status)}</td>
                <td className="p-3">{fulfillBadge(o.fulfillment_status)}</td>
                <td className="p-3">{shipBadge(o.shipping_status)}</td>
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
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                {t("admin_orders.empty", "No orders here yet.")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("admin_orders.details", "Order details")} · #{selected?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Status grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border-2 border-muted p-2 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">{t("admin_orders.payment", "Payment")}</div>
                  <div className="mt-1">{statusBadge(selected.status)}</div>
                </div>
                <div className="rounded-xl border-2 border-muted p-2 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">{t("admin_orders.delivery", "Delivery")}</div>
                  <div className="mt-1">{fulfillBadge(selected.fulfillment_status)}</div>
                </div>
                <div className="rounded-xl border-2 border-muted p-2 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">{t("admin_orders.shipping", "Shipping")}</div>
                  <div className="mt-1">{shipBadge(selected.shipping_status)}</div>
                </div>
              </div>

              {/* Order meta */}
              <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded-xl p-3">
                <div><b>{t("admin_orders.amount", "Amount")}:</b> {selected.total_amount} {selected.currency}</div>
                <div><b>{t("admin_orders.method", "Method")}:</b> {selected.payment_method ?? "—"}</div>
                <div><b>{t("admin_orders.paid_at", "Paid at")}:</b> {selected.paid_at ? new Date(selected.paid_at).toLocaleString() : "—"}</div>
                <div><b>{t("admin_orders.fulfilled_at", "Approved at")}:</b> {selected.fulfilled_at ? new Date(selected.fulfilled_at).toLocaleString() : "—"}</div>
                <div><b>{t("admin_orders.shipped_at", "Shipped at")}:</b> {selected.shipped_at ? new Date(selected.shipped_at).toLocaleString() : "—"}</div>
                <div><b>{t("admin_orders.delivered_at", "Delivered at")}:</b> {selected.delivered_at ? new Date(selected.delivered_at).toLocaleString() : "—"}</div>
                {selected.paddle_transaction_id && (
                  <div className="col-span-2"><b>Paddle TX:</b> <span className="font-mono text-xs break-all">{selected.paddle_transaction_id}</span></div>
                )}
              </div>

              {/* Shipping address */}
              <div className="rounded-xl border-2 border-muted p-3">
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {t("admin_orders.shipping_address", "Shipping address")}
                </div>
                <div className="text-sm space-y-0.5">
                  <div><b>{selected.shipping_name ?? "—"}</b> · {selected.shipping_phone ?? "—"}</div>
                  <div className="text-muted-foreground">
                    {[selected.shipping_address, selected.shipping_city, selected.shipping_country]
                      .filter(Boolean).join(", ") || "—"}
                  </div>
                  {selected.notes && (
                    <div className="mt-2 text-xs"><b>{t("admin_orders.notes", "Customer notes")}:</b> {selected.notes}</div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl border-2 border-muted p-3">
                <p className="font-bold text-sm mb-2">{t("admin_orders.items", "Items")}</p>
                {items.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ul className="space-y-1 text-sm divide-y divide-muted/60">
                    {items.data?.map((it) => (
                      <li key={it.id} className="flex justify-between gap-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {it.product_snapshot?.image && (
                            <img src={it.product_snapshot.image} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="truncate">
                            {getLocalized(it.product_snapshot?.name, i18n.language) ||
                              it.product_snapshot?.sku || "—"} × {it.quantity}
                          </span>
                        </div>
                        <span className="font-bold whitespace-nowrap">
                          {(Number(it.unit_price) * it.quantity).toFixed(2)} {it.currency}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Tracking */}
              <div className="rounded-xl border-2 border-muted p-3 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Truck className="h-4 w-4 text-primary" />
                  {t("admin_orders.tracking", "Shipment tracking")}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="carrier">{t("admin_orders.carrier", "Carrier")}</Label>
                    <Input id="carrier" value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)} placeholder="Aramex, DHL, …" />
                  </div>
                  <div>
                    <Label htmlFor="tracking">{t("admin_orders.tracking_number", "Tracking number")}</Label>
                    <Input id="tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="ABC123…" />
                  </div>
                </div>
                <button
                  onClick={persistTracking}
                  disabled={busy}
                  className="text-xs font-bold px-3 py-1.5 rounded-full bg-secondary hover:bg-accent disabled:opacity-50"
                >
                  {t("admin_orders.save_tracking", "Save tracking")}
                </button>
              </div>

              {/* Admin note */}
              <div>
                <Label>{t("admin_orders.admin_note", "Admin note (sent to customer)")}</Label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-muted bg-background text-sm"
                  rows={2}
                />
              </div>

              {/* Action buttons */}
              <div className="grid sm:grid-cols-2 gap-2">
                {selected.status === "paid" && selected.fulfillment_status !== "fulfilled" && (
                  <button
                    onClick={() => transition("approve")}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full bg-green-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t("admin_orders.approve_delivery", "Approve & notify")}
                  </button>
                )}
                {selected.fulfillment_status === "fulfilled" && selected.shipping_status === "not_shipped" && (
                  <button
                    onClick={() => transition("pack")}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full bg-amber-500 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Package className="h-4 w-4" /> {t("admin_orders.mark_packed", "Mark packed")}
                  </button>
                )}
                {(selected.shipping_status === "packed" || selected.shipping_status === "not_shipped") &&
                  selected.fulfillment_status === "fulfilled" && (
                    <button
                      onClick={() => transition("ship")}
                      disabled={busy}
                      className="px-4 py-2.5 rounded-full bg-sky-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Truck className="h-4 w-4" /> {t("admin_orders.mark_shipped", "Mark shipped & notify")}
                    </button>
                )}
                {selected.shipping_status === "shipped" && (
                  <button
                    onClick={() => transition("deliver")}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t("admin_orders.mark_delivered", "Mark delivered & notify")}
                  </button>
                )}
                {selected.status !== "cancelled" && (
                  <button
                    onClick={() => transition("cancel")}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full bg-red-600 text-white font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> {t("admin_orders.cancel_order", "Cancel & notify")}
                  </button>
                )}
                <button
                  onClick={() => notify(selected.status === "paid" ? "paid" : "fulfilled")}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" /> {t("admin_orders.resend_notif", "Resend last notification")}
                </button>
              </div>

              {/* Notifications history */}
              <div className="rounded-xl border-2 border-muted p-3">
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  <Mail className="h-4 w-4 text-primary" />
                  {t("admin_orders.notifs_history", "Notifications history")}
                </div>
                {notifs.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : notifs.data && notifs.data.length > 0 ? (
                  <ul className="text-xs space-y-1">
                    {notifs.data.map((n) => (
                      <li key={n.id} className="flex justify-between gap-2 border-b border-muted/60 py-1">
                        <span>
                          <b className="capitalize">{n.event}</b> · {n.channel} · {n.recipient ?? "—"}
                        </span>
                        <span className={
                          n.status === "queued" ? "text-emerald-700" :
                          n.status === "failed" ? "text-red-700" : "text-muted-foreground"
                        }>
                          {n.status} · {new Date(n.created_at).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("admin_orders.no_notifs", "No notifications sent yet.")}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrdersPage;
