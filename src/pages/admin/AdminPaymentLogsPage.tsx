import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Tx {
  id: string;
  user_id: string | null;
  paddle_transaction_id: string | null;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  tier: string | null;
  event_type: string;
  status: string | null;
  amount_cents: number | null;
  currency: string | null;
  occurred_at: string | null;
  created_at: string;
  raw: unknown;
}

async function fetchTransactions(search: string, eventFilter: string): Promise<Tx[]> {
  let q = supabase
    .from("paddle_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (eventFilter !== "all") q = q.like("event_type", `${eventFilter}%`);
  if (search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(
      `paddle_transaction_id.ilike.${s},paddle_subscription_id.ilike.${s},paddle_customer_id.ilike.${s},tier.ilike.${s}`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Tx[];
}

export default function AdminPaymentLogsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "transaction" | "subscription" | "adjustment">("all");
  const [selected, setSelected] = useState<Tx | null>(null);

  const q = useQuery({
    queryKey: ["paddle-transactions", search, filter],
    queryFn: () => fetchTransactions(search, filter),
  });

  const totals = q.data
    ? q.data.reduce(
        (acc, t) => {
          if (t.event_type.startsWith("transaction.") && t.status === "completed" && t.amount_cents) {
            acc.usdCents += t.amount_cents;
            acc.count += 1;
          }
          return acc;
        },
        { usdCents: 0, count: 0 },
      )
    : { usdCents: 0, count: 0 };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Paddle Payment Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Every Paddle webhook event (transactions, subscriptions, adjustments) logged for audit.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tx / sub / customer / tier…"
            className="pl-8 w-72"
          />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-card border-2 border-muted p-4">
          <p className="text-xs text-muted-foreground">Completed transactions</p>
          <p className="text-2xl font-extrabold">{totals.count}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-card border-2 border-muted p-4">
          <p className="text-xs text-muted-foreground">Total collected (visible)</p>
          <p className="text-2xl font-extrabold">${(totals.usdCents / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-card border-2 border-muted p-4">
          <p className="text-xs text-muted-foreground">Events shown</p>
          <p className="text-2xl font-extrabold">{q.data?.length ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "transaction", "subscription", "adjustment"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {q.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

      <div className="overflow-x-auto bg-white dark:bg-card rounded-2xl border-2 border-muted">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-start p-3">Date</th>
              <th className="text-start p-3">Event</th>
              <th className="text-start p-3">Status</th>
              <th className="text-start p-3">Tier</th>
              <th className="text-start p-3">Amount</th>
              <th className="text-start p-3">Tx ID</th>
              <th className="text-start p-3">Sub ID</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No payment events yet. Trigger a Paddle Sandbox test to populate this log.
                </td>
              </tr>
            )}
            {q.data?.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelected(t)}
                className="border-t border-muted hover:bg-muted/30 cursor-pointer"
              >
                <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="p-3 font-mono text-xs">{t.event_type}</td>
                <td className="p-3 capitalize">{t.status ?? "—"}</td>
                <td className="p-3 capitalize">{t.tier ?? "—"}</td>
                <td className="p-3">
                  {t.amount_cents != null && t.currency
                    ? `${(t.amount_cents / 100).toFixed(2)} ${t.currency}`
                    : "—"}
                </td>
                <td className="p-3 font-mono text-[11px] max-w-[140px] truncate">
                  {t.paddle_transaction_id ?? "—"}
                </td>
                <td className="p-3 font-mono text-[11px] max-w-[140px] truncate">
                  {t.paddle_subscription_id ?? "—"}
                </td>
                <td className="p-3 text-right">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment event details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><b>Event:</b> <span className="font-mono text-xs">{selected.event_type}</span></div>
                <div><b>Status:</b> {selected.status ?? "—"}</div>
                <div><b>Tier:</b> {selected.tier ?? "—"}</div>
                <div><b>Amount:</b> {selected.amount_cents != null ? `${(selected.amount_cents / 100).toFixed(2)} ${selected.currency ?? ""}` : "—"}</div>
                <div className="col-span-2"><b>User:</b> <span className="font-mono text-xs">{selected.user_id ?? "—"}</span></div>
                <div className="col-span-2"><b>Transaction ID:</b> <span className="font-mono text-xs">{selected.paddle_transaction_id ?? "—"}</span></div>
                <div className="col-span-2"><b>Subscription ID:</b> <span className="font-mono text-xs">{selected.paddle_subscription_id ?? "—"}</span></div>
                <div className="col-span-2"><b>Customer ID:</b> <span className="font-mono text-xs">{selected.paddle_customer_id ?? "—"}</span></div>
                <div className="col-span-2"><b>Occurred at:</b> {selected.occurred_at ? new Date(selected.occurred_at).toLocaleString() : "—"}</div>
              </div>
              <details className="rounded-xl border-2 border-muted bg-muted/30 p-3">
                <summary className="cursor-pointer font-bold">Raw payload</summary>
                <pre className="text-[11px] overflow-x-auto mt-2">{JSON.stringify(selected.raw, null, 2)}</pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
