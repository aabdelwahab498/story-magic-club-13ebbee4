import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Crown, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { fetchMyPaymentRequests } from "@/lib/subscriptionApi";

const statusBadge = (s: string, isAr: boolean) => {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-amber-100 text-amber-800", label: isAr ? "قيد المراجعة" : "Pending" },
    approved: { cls: "bg-green-100 text-green-800", label: isAr ? "مقبول" : "Approved" },
    rejected: { cls: "bg-red-100 text-red-800", label: isAr ? "مرفوض" : "Rejected" },
  };
  const m = map[s] ?? map.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.cls}`}>{m.label}</span>;
};

const AccountSubscription = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { user } = useAuth();
  const sub = useSubscription();

  const requestsQ = useQuery({
    queryKey: ["my-payment-requests", user?.id],
    queryFn: () => (user ? fetchMyPaymentRequests(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p>{isAr ? "سجّل الدخول لعرض اشتراكك" : "Sign in to view your subscription"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">
          {isAr ? "اشتراكي" : "My Subscription"}
        </h1>
      </header>

      {/* Current plan */}
      <section className="bg-gradient-to-br from-kids-softYellow to-kids-softPurple/40 dark:from-card/90 dark:to-card/70 rounded-3xl p-6 border-2 border-white/60 shadow-soft">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {isAr ? "الخطة الحالية" : "Current plan"}
            </p>
            <h2 className="text-3xl font-extrabold flex items-center gap-2">
              <Crown className="h-7 w-7 text-amber-500" />
              {sub.plan?.name[isAr ? "ar" : "en"] ?? sub.tier}
            </h2>
          </div>
          {sub.tier === "free" && (
            <Link
              to="/pricing"
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm hover-pop"
            >
              {isAr ? "ترقية" : "Upgrade"}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{isAr ? "هذا الشهر" : "This month"}</p>
            <p className="font-bold text-lg">
              {sub.storiesUsedThisMonth} / {sub.plan?.monthly_story_limit ?? 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{isAr ? "متبقي" : "Remaining"}</p>
            <p className="font-bold text-lg">{sub.remainingStories}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{isAr ? "رسومات" : "Illustrations"}</p>
            <p className="font-bold">
              {sub.canIllustrate ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">PDF</p>
            <p className="font-bold">
              {sub.canExportPdf ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
            </p>
          </div>
        </div>
        {sub.expiresAt && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isAr ? "ينتهي في:" : "Expires:"} {new Date(sub.expiresAt).toLocaleDateString()}
          </p>
        )}
      </section>

      {/* Payment history */}
      <section className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60">
        <h2 className="font-bold mb-3">{isAr ? "طلبات الدفع" : "Payment requests"}</h2>
        {requestsQ.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {requestsQ.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد طلبات" : "No requests yet"}</p>
        )}
        <ul className="divide-y divide-muted">
          {requestsQ.data?.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm capitalize">{r.plan_tier} — {r.method.replace("_", " ")}</p>
                <p className="text-xs text-muted-foreground">
                  {r.amount} {r.currency} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.admin_note && <p className="text-xs text-red-600 mt-1">{r.admin_note}</p>}
              </div>
              {statusBadge(r.status, !!isAr)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AccountSubscription;
