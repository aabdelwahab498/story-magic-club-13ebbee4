import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Clock, CreditCard, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SubRow = {
  id: string;
  user_id: string;
  plan_tier: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  payment_method: string | null;
  created_at: string;
};

type PaddleWebhookRow = {
  id: string;
  event_id: string;
  event_type: string;
  processed_at: string | null;
  error: string | null;
  created_at: string;
};

type ManualReqRow = {
  id: string;
  user_id: string;
  plan_tier: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const StatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "pending"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : status === "expired" || status === "superseded"
      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      : status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected" || status === "cancelled" || status === "canceled"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : "bg-muted text-foreground";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${cls}`}>
      {status}
    </span>
  );
};

const AdminSubscriptionsPage = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [tab, setTab] = useState<"subs" | "paddle" | "manual">("subs");

  const subsQ = useQuery({
    queryKey: ["admin-all-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("id,user_id,plan_tier,status,starts_at,expires_at,payment_method,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SubRow[];
    },
  });

  const paddleQ = useQuery({
    queryKey: ["admin-paddle-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paddle_webhook_events")
        .select("id,event_id,event_type,processed_at,error,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PaddleWebhookRow[];
    },
    enabled: tab === "paddle",
  });

  const manualQ = useQuery({
    queryKey: ["admin-manual-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_payment_requests")
        .select("id,user_id,plan_tier,amount,currency,method,status,admin_note,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ManualReqRow[];
    },
    enabled: tab === "manual",
  });

  const tabs: { key: typeof tab; label: string; icon: typeof CreditCard }[] = [
    { key: "subs", label: isAr ? "الاشتراكات" : "Subscriptions", icon: CheckCircle2 },
    { key: "paddle", label: isAr ? "أحداث Paddle" : "Paddle events", icon: CreditCard },
    { key: "manual", label: isAr ? "محاولات الدفع المحلي" : "Local payment attempts", icon: Clock },
  ];

  const counts = (() => {
    const list = subsQ.data ?? [];
    return {
      active: list.filter((s) => s.status === "active").length,
      expired: list.filter((s) => s.status === "expired").length,
      cancelled: list.filter((s) => s.status === "cancelled" || s.status === "canceled").length,
      superseded: list.filter((s) => s.status === "superseded").length,
    };
  })();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">
          {isAr ? "حالة الاشتراكات والدفع" : "Subscriptions & Payments Status"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "تتبّع حالة كل اشتراك وسجل محاولات Paddle والوسائل المحلية مع أسباب الفشل."
            : "Track every subscription and review Paddle and local payment attempts with failure reasons."}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: isAr ? "نشط" : "Active", value: counts.active, cls: "from-emerald-500 to-teal-500" },
          { label: isAr ? "منتهي" : "Expired", value: counts.expired, cls: "from-slate-500 to-slate-700" },
          { label: isAr ? "ملغي" : "Cancelled", value: counts.cancelled, cls: "from-rose-500 to-red-500" },
          { label: isAr ? "تم استبداله" : "Superseded", value: counts.superseded, cls: "from-amber-500 to-orange-500" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl p-4 text-white bg-gradient-to-br ${c.cls}`}>
            <p className="text-xs font-bold opacity-90">{c.label}</p>
            <p className="text-3xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 inline-flex items-center gap-1.5 ${
                tab === tb.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-muted text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === "subs" && (
        <Section loading={subsQ.isLoading} empty={!subsQ.data?.length}>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-start p-3">{isAr ? "تاريخ" : "Date"}</th>
                <th className="text-start p-3">{isAr ? "المستخدم" : "User"}</th>
                <th className="text-start p-3">{isAr ? "الخطة" : "Plan"}</th>
                <th className="text-start p-3">{isAr ? "الحالة" : "Status"}</th>
                <th className="text-start p-3">{isAr ? "الوسيلة" : "Method"}</th>
                <th className="text-start p-3">{isAr ? "ينتهي في" : "Expires"}</th>
              </tr>
            </thead>
            <tbody>
              {subsQ.data?.map((r) => (
                <tr key={r.id} className="border-t border-muted">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3 font-mono text-[11px]">{r.user_id.slice(0, 8)}…</td>
                  <td className="p-3 capitalize font-bold">{r.plan_tier}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 capitalize">{(r.payment_method ?? "—").replace("_", " ")}</td>
                  <td className="p-3 whitespace-nowrap">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === "paddle" && (
        <Section loading={paddleQ.isLoading} empty={!paddleQ.data?.length}>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-start p-3">{isAr ? "تاريخ" : "Date"}</th>
                <th className="text-start p-3">{isAr ? "نوع الحدث" : "Event"}</th>
                <th className="text-start p-3">{isAr ? "الحالة" : "Status"}</th>
                <th className="text-start p-3">{isAr ? "سبب الفشل" : "Failure reason"}</th>
              </tr>
            </thead>
            <tbody>
              {paddleQ.data?.map((r) => (
                <tr key={r.id} className="border-t border-muted align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-[12px]">{r.event_type}</td>
                  <td className="p-3">
                    {r.error ? (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs">
                        <XCircle className="h-3.5 w-3.5" /> {isAr ? "فشل" : "Failed"}
                      </span>
                    ) : r.processed_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {isAr ? "تمت" : "Processed"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-xs">
                        <Clock className="h-3.5 w-3.5" /> {isAr ? "قيد المعالجة" : "Pending"}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-rose-600 break-all max-w-[400px]">
                    {r.error ? (
                      <span className="inline-flex items-start gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {r.error}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {tab === "manual" && (
        <Section loading={manualQ.isLoading} empty={!manualQ.data?.length}>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-start p-3">{isAr ? "تاريخ" : "Date"}</th>
                <th className="text-start p-3">{isAr ? "المستخدم" : "User"}</th>
                <th className="text-start p-3">{isAr ? "الخطة" : "Plan"}</th>
                <th className="text-start p-3">{isAr ? "المبلغ" : "Amount"}</th>
                <th className="text-start p-3">{isAr ? "الوسيلة" : "Method"}</th>
                <th className="text-start p-3">{isAr ? "الحالة" : "Status"}</th>
                <th className="text-start p-3">{isAr ? "ملاحظة المراجعة / سبب الرفض" : "Admin note / reject reason"}</th>
              </tr>
            </thead>
            <tbody>
              {manualQ.data?.map((r) => (
                <tr key={r.id} className="border-t border-muted align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3 font-mono text-[11px]">{r.user_id.slice(0, 8)}…</td>
                  <td className="p-3 capitalize font-bold">{r.plan_tier}</td>
                  <td className="p-3 whitespace-nowrap">{r.amount} {r.currency}</td>
                  <td className="p-3 capitalize">{r.method.replace("_", " ")}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground break-words max-w-[300px]">
                    {r.admin_note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
};

const Section = ({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) => {
  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground bg-white dark:bg-card rounded-2xl border-2 border-muted">
        No records
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-card rounded-2xl border-2 border-muted">
      {children}
    </div>
  );
};

export default AdminSubscriptionsPage;
